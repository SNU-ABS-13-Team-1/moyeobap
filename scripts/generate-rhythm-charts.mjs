// public/*.mp3(모여밥 BGM 3곡)를 분석해서 리듬게임 채보를
// app/lib/rhythm/charts.generated.ts로 만든다.
//
//     node scripts/generate-rhythm-charts.mjs   (= npm run rhythm:build)
//
// 정본은 mp3 파일이다. charts.generated.ts는 이 스크립트가 만드는
// 생성물이므로 직접 고치지 않는다. 고쳐도 다음 실행에서 덮어써진다.
//
// 원리: 보컬곡이라 BPM 메타데이터가 없으므로, 오디오 에너지의 변화량(onset
// strength)으로 박자를 직접 추정한다.
//   1) ffmpeg로 mono 22.05kHz PCM으로 디코드
//   2) 짧은 구간(93ms, 23ms hop)마다 에너지를 구하고, 그 증가분(flux)을
//      "박자가 있을 법한 지점"의 세기로 쓴다
//   3) flux를 자기상관(autocorrelation)해서 가장 우세한 박자 주기를 찾고
//      그 주기로 8분음표 간격의 격자(beat grid)를 만든다
//   4) 격자점마다 그 지점의 실제 flux 세기를 매겨, 세기가 강한 상위 점만
//      노트로 남긴다(약한 격자점은 건너뛰어 무음 구간에 노트가 안 박히게)
//   5) 레인은 같은 레인이 연달아 나오지 않게, 강한 박에는 가끔 화음(2레인)을
//      섞어서 배정한다
//
// 자동 생성이라 사람이 짠 채보만큼 "손맛"이 좋진 않지만, 실제 곡의 박자와
// 어긋나지는 않는다.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app/lib/rhythm/charts.generated.ts');

const SAMPLE_RATE = 22050;
const FRAME_SIZE = 2048; // ~93ms
const HOP_SIZE = 512; // ~23ms

const SONGS = [
  { id: 'bgm', file: 'bgm.mp3', label: '모여밥 시그니처' },
  { id: 'acoustic', file: 'bgm-acoustic.mp3', label: '모여밥 어쿠스틱' },
  { id: 'girlgroup', file: 'bgm-girlgroup.mp3', label: '모여밥 걸그룹' },
];

const LANE_COUNT = 4;
const MIN_NOTE_GAP_MS = 140; // 한 레인이 아니라 "아무 노트나" 최소 간격(너무 몰리지 않게)

function decodeToPcm(mp3Path) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rhythm-'));
  const pcmPath = join(tmpDir, 'out.pcm');
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', mp3Path,
    '-ac', '1',
    '-ar', String(SAMPLE_RATE),
    '-f', 's16le',
    pcmPath,
  ]);
  const buf = readFileSync(pcmPath);
  rmSync(tmpDir, { recursive: true, force: true });
  const samples = new Float32Array(buf.length / 2);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = buf.readInt16LE(i * 2) / 32768;
  }
  return samples;
}

/** 프레임별 RMS 에너지 배열. */
function computeEnergy(samples) {
  const frameCount = Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE) + 1;
  const energy = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    const start = i * HOP_SIZE;
    let sum = 0;
    for (let j = 0; j < FRAME_SIZE; j += 1) {
      const s = samples[start + j];
      sum += s * s;
    }
    energy[i] = Math.sqrt(sum / FRAME_SIZE);
  }
  return energy;
}

/** onset 세기(flux) = 에너지 증가분만(half-wave rectified), 3프레임 이동평균으로 살짝 스무딩. */
function computeFlux(energy) {
  const raw = new Float32Array(energy.length);
  for (let i = 1; i < energy.length; i += 1) {
    raw[i] = Math.max(0, energy[i] - energy[i - 1]);
  }
  const flux = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(raw.length - 1, i + 1)];
    flux[i] = (a + b + c) / 3;
  }
  return flux;
}

/** flux 자기상관으로 60~180BPM 범위에서 가장 우세한 박자 주기(ms)를 찾는다. */
function estimateBeatPeriodMs(flux) {
  const hopMs = (HOP_SIZE / SAMPLE_RATE) * 1000;
  const minLag = Math.round(60000 / 180 / hopMs); // 180BPM
  const maxLag = Math.round(60000 / 60 / hopMs); // 60BPM

  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let i = 0; i + lag < flux.length; i += 1) {
      score += flux[i] * flux[i + lag];
    }
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return bestLag * hopMs;
}

/** 격자 위상(phase, ms): flux가 가장 강한 초반 프레임을 기준으로 잡는다. */
function estimatePhaseMs(flux, periodMs) {
  const hopMs = (HOP_SIZE / SAMPLE_RATE) * 1000;
  const searchFrames = Math.min(flux.length, Math.round((periodMs * 8) / hopMs));
  let bestFrame = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < searchFrames; i += 1) {
    if (flux[i] > bestVal) {
      bestVal = flux[i];
      bestFrame = i;
    }
  }
  return (bestFrame * hopMs) % periodMs;
}

function fluxAt(flux, timeMs) {
  const hopMs = (HOP_SIZE / SAMPLE_RATE) * 1000;
  const frame = Math.round(timeMs / hopMs);
  let best = 0;
  for (let d = -1; d <= 1; d += 1) {
    const idx = frame + d;
    if (idx >= 0 && idx < flux.length) best = Math.max(best, flux[idx]);
  }
  return best;
}

function buildChart(flux, durationMs, periodMs, phaseMs) {
  const eighthMs = periodMs / 2;
  const candidates = [];
  for (let t = phaseMs; t < durationMs - 1500; t += eighthMs) {
    if (t < 1500) continue; // 도입부 1.5초는 노트 없이 곡을 들려준다
    candidates.push({ time: Math.round(t), strength: fluxAt(flux, t) });
  }

  // 상위 45%만 노트로 남긴다(너무 빽빽하지도, 휑하지도 않게).
  const sorted = [...candidates].sort((a, b) => b.strength - a.strength);
  const keepCount = Math.round(sorted.length * 0.45);
  const threshold = sorted[Math.min(keepCount, sorted.length - 1)]?.strength ?? 0;

  const notes = [];
  let lastTime = -Infinity;
  let lastLane = -1;
  let id = 0;
  let strongCounter = 0;

  for (const c of candidates) {
    if (c.strength < threshold) continue;
    if (c.time - lastTime < MIN_NOTE_GAP_MS) continue;

    strongCounter += 1;
    let lane = (lastLane + 1 + (strongCounter % 2)) % LANE_COUNT;
    if (lane === lastLane) lane = (lane + 1) % LANE_COUNT;

    notes.push({ id: id++, time: c.time, lane });

    // 8마디마다 한 번 정도 화음(2레인)을 섞어 단조롭지 않게.
    if (strongCounter % 16 === 0) {
      const chordLane = (lane + 2) % LANE_COUNT;
      notes.push({ id: id++, time: c.time, lane: chordLane });
    }

    lastTime = c.time;
    lastLane = lane;
  }

  return notes;
}

function analyzeSong(song) {
  const mp3Path = join(ROOT, 'public', song.file);
  if (!existsSync(mp3Path)) {
    throw new Error(`${mp3Path} 가 없습니다.`);
  }
  console.log(`[${song.id}] 디코딩 중...`);
  const samples = decodeToPcm(mp3Path);
  const durationMs = (samples.length / SAMPLE_RATE) * 1000;

  console.log(`[${song.id}] 온셋 분석 중... (${(durationMs / 1000).toFixed(1)}초)`);
  const energy = computeEnergy(samples);
  const flux = computeFlux(energy);
  const periodMs = estimateBeatPeriodMs(flux);
  const phaseMs = estimatePhaseMs(flux, periodMs);
  const bpm = 60000 / periodMs;

  const notes = buildChart(flux, durationMs, periodMs, phaseMs);
  console.log(`[${song.id}] BPM ${bpm.toFixed(1)} 추정, 노트 ${notes.length}개, 길이 ${(durationMs / 1000).toFixed(1)}초`);

  return { id: song.id, label: song.label, file: song.file, bpm, durationMs: Math.round(durationMs), notes };
}

function main() {
  const results = SONGS.map(analyzeSong);

  const header = `// 자동 생성 파일입니다. 손으로 고치지 마세요 — 직접 고쳐도 다음
// \`node scripts/generate-rhythm-charts.mjs\` 실행에서 덮어써집니다.
// 정본은 public/*.mp3이고, 이 파일은 scripts/generate-rhythm-charts.mjs가
// 온셋(박자 세기) 분석으로 만든 결과물입니다.

import type { ChartNote } from './types';

export type RhythmSong = {
  id: string;
  label: string;
  file: string;
  bpm: number;
  durationMs: number;
  chart: ChartNote[];
};

export const RHYTHM_SONGS: RhythmSong[] = ${JSON.stringify(
    results.map((r) => ({
      id: r.id,
      label: r.label,
      file: `/${r.file}`,
      bpm: Math.round(r.bpm * 10) / 10,
      durationMs: r.durationMs,
      chart: r.notes,
    })),
    null,
    2,
  )};
`;

  writeFileSync(OUT, header);
  console.log(`\n작성 완료: ${OUT}`);
}

main();
