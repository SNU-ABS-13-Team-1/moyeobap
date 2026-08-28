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
//      자기상관(autocorrelation)해서 가장 우세한 박자 주기(BPM)를 찾는다.
//      최고점 주변을 포물선 보간해 소수점 단위까지 다듬는다 — 정수 프레임
//      (~23ms) 해상도 그대로 쓰면 3~4분짜리 곡 끝부분에서 박자가 눈에 띄게
//      밀린다.
//   3) 그 주기로 만든 박자 격자(beat grid) 위에, 사람이 짠 것과 같은
//      "프레이즈 패턴"(4박 단위)을 그대로 얹는다. 실제 온셋 세기로 노트를
//      골라내던 예전 방식은 조용한 구간이 통째로 비어버리는 문제가 있어서,
//      이제는 격자 위에 항상 패턴을 채운다 — 그래서 "노트가 없는 지루한
//      구간"이 안 생기고, 격자에서 그대로 뽑으므로 박자도 항상 딱 맞는다.
//   4) 난이도(easy/normal/hard)는 곡 중간에 섞어 올리지 않고, 곡마다 그
//      난이도의 패턴 하나로 처음부터 끝까지 간다 — 이전엔 곡 후반부를
//      항상 제일 어려운 패턴으로 채웠더니 "후반이 너무 어렵다"는 피드백을
//      받았다. 이제 플레이어가 시작 전에 난이도를 고르고, 그 난이도가 곡
//      끝까지 일정하게 유지된다.
//   5) 레인은 같은 레인이 연달아 나오지 않게 순환시키고, 프레이즈 반복마다
//      살짝 회전시켜(laneShift) 단조롭지 않게 한다.

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
const PHRASE_LENGTH_BEATS = 4;

// 4분음표 위주, 한 번에 한 레인만 — 입문 구간.
const PHRASE_EASY = [
  { beatOffset: 0, lanes: [0] },
  { beatOffset: 1, lanes: [1] },
  { beatOffset: 2, lanes: [2] },
  { beatOffset: 3, lanes: [1] },
];

// 8분음표 섞임 + 화음(동시치기) 하나 — 중급 구간.
const PHRASE_MEDIUM = [
  { beatOffset: 0, lanes: [0] },
  { beatOffset: 0.5, lanes: [1] },
  { beatOffset: 1, lanes: [2] },
  { beatOffset: 1.5, lanes: [1] },
  { beatOffset: 2, lanes: [3] },
  { beatOffset: 2.5, lanes: [2] },
  { beatOffset: 3, lanes: [0, 2] },
  { beatOffset: 3.5, lanes: [1] },
];

// 16분음표 몰아치기 + 화음 다수 — 상급 구간.
const PHRASE_HARD = [
  { beatOffset: 0, lanes: [0] },
  { beatOffset: 0.25, lanes: [1] },
  { beatOffset: 0.5, lanes: [2] },
  { beatOffset: 0.75, lanes: [3] },
  { beatOffset: 1, lanes: [2] },
  { beatOffset: 1.25, lanes: [1] },
  { beatOffset: 1.5, lanes: [0, 2] },
  { beatOffset: 2, lanes: [1] },
  { beatOffset: 2.25, lanes: [3] },
  { beatOffset: 2.5, lanes: [0] },
  { beatOffset: 2.75, lanes: [1, 3] },
  { beatOffset: 3, lanes: [2] },
  { beatOffset: 3.5, lanes: [0, 3] },
];

// 4분음표로 정리하며 마지막에 전체 화음으로 마무리하는 아웃트로.
const PHRASE_OUTRO = [
  { beatOffset: 0, lanes: [3] },
  { beatOffset: 1, lanes: [2] },
  { beatOffset: 2, lanes: [1] },
  { beatOffset: 3, lanes: [0, 3] },
];

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

/** flux 자기상관으로 60~180BPM 범위에서 가장 우세한 박자 주기(ms)를 찾는다.
 * 정수 프레임(hop, ~23ms) 해상도로만 고르면 그 오차가 곡 전체에 누적돼
 * 후반부에서 박자가 눈에 띄게 밀리므로, 최고점 주변을 포물선 보간해
 * 소수점 단위 정밀도로 다듬는다. */
function estimateBeatPeriodMs(flux) {
  const hopMs = (HOP_SIZE / SAMPLE_RATE) * 1000;
  const minLag = Math.round(60000 / 180 / hopMs); // 180BPM
  const maxLag = Math.round(60000 / 60 / hopMs); // 60BPM

  function scoreAt(lag) {
    let score = 0;
    for (let i = 0; i + lag < flux.length; i += 1) {
      score += flux[i] * flux[i + lag];
    }
    return score;
  }

  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const score = scoreAt(lag);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const sPrev = scoreAt(bestLag - 1);
  const sCurr = bestScore;
  const sNext = scoreAt(bestLag + 1);
  const denom = sPrev - 2 * sCurr + sNext;
  const delta = denom !== 0 ? Math.max(-1, Math.min(1, (0.5 * (sPrev - sNext)) / denom)) : 0;

  return (bestLag + delta) * hopMs;
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

const DIFFICULTY_PHRASES = {
  easy: PHRASE_EASY,
  normal: PHRASE_MEDIUM,
  hard: PHRASE_HARD,
};

/**
 * 박자 격자 위에 프레이즈 패턴 하나를 처음부터 끝까지 반복해서 채보를
 * 만든다. 실제 온셋 세기로 노트를 골라내지 않으므로(조용한 구간이 통째로
 * 비는 문제 회피), 격자에서 그대로 뽑힌 시각은 항상 박자와 정확히 맞는다.
 * 마지막 한 마디만 정리 느낌의 아웃트로로 마무리한다.
 */
function buildChart(durationMs, periodMs, phaseMs, mainPhrase) {
  const notes = [];
  let id = 0;

  // 도입부는 최소 1.5초 동안 노트 없이 곡을 들려주되, 그 시작점도 격자에
  // 맞춥니다(그래야 첫 노트부터 박자가 어긋나지 않습니다).
  const minStartMs = 1500;
  const beatsToSkip = Math.max(0, Math.ceil((minStartMs - phaseMs) / periodMs));
  const startMs = phaseMs + beatsToSkip * periodMs;
  const outroMarginMs = 2500;
  const usableMs = Math.max(0, durationMs - startMs - outroMarginMs);
  const phrasesAvailable = Math.max(4, Math.floor(usableMs / periodMs / PHRASE_LENGTH_BEATS));

  const mainRepeats = Math.max(2, phrasesAvailable - 1);
  const sections = [
    { phrase: mainPhrase, repeats: mainRepeats },
    { phrase: PHRASE_OUTRO, repeats: 1 },
  ];

  let startBeat = 0;
  for (const section of sections) {
    for (let rep = 0; rep < section.repeats; rep += 1) {
      const shift = rep % LANE_COUNT;
      for (const n of section.phrase) {
        const beat = startBeat + rep * PHRASE_LENGTH_BEATS + n.beatOffset;
        const time = Math.round(startMs + beat * periodMs);
        // 폰에서는 엄지 두 개로 플레이하므로, 위 패턴에 실수로 3~4레인
        // 동시치기를 넣더라도 여기서 항상 최대 2개까지만 남긴다.
        for (const lane of n.lanes.slice(0, 2)) {
          notes.push({ id: id++, time, lane: (lane + shift) % LANE_COUNT });
        }
      }
    }
    startBeat += section.repeats * PHRASE_LENGTH_BEATS;
  }

  return notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
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

  const charts = {};
  for (const [difficulty, phrase] of Object.entries(DIFFICULTY_PHRASES)) {
    charts[difficulty] = buildChart(durationMs, periodMs, phaseMs, phrase);
  }
  console.log(
    `[${song.id}] BPM ${bpm.toFixed(1)} 추정, 노트 수 easy ${charts.easy.length} / normal ${charts.normal.length} / hard ${charts.hard.length}, 길이 ${(durationMs / 1000).toFixed(1)}초`,
  );

  return { id: song.id, label: song.label, file: song.file, bpm, durationMs: Math.round(durationMs), charts };
}

function main() {
  const results = SONGS.map(analyzeSong);

  const header = `// 자동 생성 파일입니다. 손으로 고치지 마세요 — 직접 고쳐도 다음
// \`node scripts/generate-rhythm-charts.mjs\` 실행에서 덮어써집니다.
// 정본은 public/*.mp3이고, 이 파일은 scripts/generate-rhythm-charts.mjs가
// 온셋(박자 세기) 분석으로 만든 결과물입니다.

import type { ChartNote } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type RhythmSong = {
  id: string;
  label: string;
  file: string;
  bpm: number;
  durationMs: number;
  charts: Record<Difficulty, ChartNote[]>;
};

export const RHYTHM_SONGS: RhythmSong[] = ${JSON.stringify(
    results.map((r) => ({
      id: r.id,
      label: r.label,
      file: `/${r.file}`,
      bpm: Math.round(r.bpm * 10) / 10,
      durationMs: r.durationMs,
      charts: r.charts,
    })),
    null,
    2,
  )};
`;

  writeFileSync(OUT, header);
  console.log(`\n작성 완료: ${OUT}`);
}

main();
