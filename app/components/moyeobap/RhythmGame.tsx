'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { requestJson } from '../../lib/api-client';
import { RhythmAudioEngine } from '../../lib/rhythm/audio';
import { RHYTHM_SONGS, type Difficulty, type RhythmSong } from '../../lib/rhythm/charts.generated';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GOOD_WINDOW_MS,
  JUDGMENT_LINE_Y,
  LANE_COUNT,
  LANE_KEY_CODES,
  LANE_LABELS,
  NOTE_RADIUS,
  NOTE_TRAVEL_MS,
} from '../../lib/rhythm/constants';
import { getJudgmentPoints, judgeHit } from '../../lib/rhythm/judgment';
import type { JudgmentTier } from '../../lib/rhythm/types';
import { useAuth } from './AuthProvider';
import { POLLING_PRESETS } from '../../lib/swrConfig';
import { HallOfFame, type HallWeek } from './HallOfFame';
import { RankMedal, rankRowClass } from './RankMedal';
import { WeekNote, type WeekInfo } from './WeekNote';

const GAME_KEY = 'rhythm';
const LEADERBOARD_URL = `/api/games/${GAME_KEY}/scores`;

/** rank는 서버가 매긴 공동 순위입니다. 점수가 같으면 같은 값이라, 목록의 몇 번째인지로 세면 안 됩니다. */
type ScoreEntry = { userId: string; userName: string; bestScore: number; rank: number };
type LeaderboardResponse = { leaderboard: ScoreEntry[]; myRank: number | null; week?: WeekInfo; hall?: HallWeek[] };
type Status = 'idle' | 'loading' | 'playing' | 'over';

type NoteState = { id: number; time: number; lane: number; judged: boolean; tier: JudgmentTier | null };
type Effect = { id: number; lane: number; text: string; tier: JudgmentTier; createdAt: number };

const LANE_COLORS = ['#ff6b6b', '#ffd43b', '#4dd4ff', '#c77dff'];
const JUDGMENT_LABEL: Record<JudgmentTier, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
// hard(16분음표 몰아치기)는 너무 어렵다는 피드백으로 선택지에서 뺐습니다
// (데이터는 charts.generated.ts에 그대로 있지만 UI에서 고를 수 없게만
// 막았습니다). normal 채보를 "어려움"으로 보여줘서 쉬움/어려움 2단계만
// 고르게 합니다. 버튼 색도 라벨에 맞춰 easy=초록, normal="어려움"=빨강으로 씁니다.
const DIFFICULTIES: Difficulty[] = ['easy', 'normal'];
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '쉬움', normal: '어려움', hard: '어려움' };
const DIFFICULTY_STYLE: Record<Difficulty, string> = { easy: 'easy', normal: 'hard', hard: 'hard' };

function laneX(lane: number): number {
  return (CANVAS_WIDTH / (LANE_COUNT + 1)) * (lane + 1);
}

export function RhythmGame() {
  const { currentUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR<LeaderboardResponse>(
    LEADERBOARD_URL,
    fetcher,
    POLLING_PRESETS.GAME_RANKING,
  );

  const [status, setStatus] = useState<Status>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboBumpKey, setComboBumpKey] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [newRecord, setNewRecord] = useState(false);
  const [judgmentCounts, setJudgmentCounts] = useState<Record<JudgmentTier, number>>({
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  });

  const statusRef = useRef<Status>('idle');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const audioEngineRef = useRef<RhythmAudioEngine | null>(null);
  const hitLaneRef = useRef<((lane: number) => void) | null>(null);
  const selectedSongRef = useRef<RhythmSong | null>(null);
  const selectedDifficultyRef = useRef<Difficulty>('normal');
  const [loadError, setLoadError] = useState<string | null>(null);
  // 곡을 고른 뒤 난이도를 고르는 중간 단계입니다(2단계 선택). null이면
  // 곡 목록을, 값이 있으면 그 곡의 난이도 버튼을 보여줍니다.
  const [pickingSong, setPickingSong] = useState<RhythmSong | null>(null);

  // 지금 누르고 있는 레인(키보드 홀드 중 + 탭 버튼 터치 중). 캔버스
  // 판정선 마커는 매 프레임 이 ref를 직접 읽고(리렌더 없이), 아래 탭
  // 버튼은 React state로 눌림 스타일을 반영합니다 — 뭘 눌렀는지 눈으로
  // 바로 보여서 정확히 맞추기 쉽게 하기 위한 것입니다.
  const pressedLanesRef = useRef<Set<number>>(new Set());
  const [pressedLanes, setPressedLanes] = useState<Set<number>>(new Set());

  function setLanePressed(lane: number, pressed: boolean) {
    const next = new Set(pressedLanesRef.current);
    if (pressed) next.add(lane);
    else next.delete(lane);
    pressedLanesRef.current = next;
    setPressedLanes(next);
  }

  useEffect(() => {
    if (!currentUser || !leaderboardData) return;
    const mine = leaderboardData.leaderboard.find((entry) => entry.userId === currentUser.id);
    if (mine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBest((prev) => Math.max(prev, mine.bestScore));
    }
  }, [leaderboardData, currentUser]);

  async function startGame(song: RhythmSong, difficulty: Difficulty) {
    const statusBefore: Status = statusRef.current;
    if (statusBefore === 'playing' || statusBefore === 'loading') return;
    audioEngineRef.current?.stop();
    selectedSongRef.current = song;
    selectedDifficultyRef.current = difficulty;
    setLoadError(null);
    setStatus('loading');
    const engine = new RhythmAudioEngine();
    audioEngineRef.current = engine;
    try {
      await engine.load(song.file);
    } catch {
      setLoadError('곡을 불러오지 못했어요. 다시 시도해주세요.');
      setStatus('idle');
      return;
    }
    // 로딩 중 사용자가 다른 곡을 다시 골랐거나 나가버렸으면 재생을 시작하지 않습니다.
    const statusAfter: Status = statusRef.current;
    if (statusAfter !== 'loading' || audioEngineRef.current !== engine) return;
    engine.start();
    setStatus('playing');
  }

  function restartSelected() {
    if (selectedSongRef.current) void startGame(selectedSongRef.current, selectedDifficultyRef.current);
  }

  // status는 'playing'으로 유지한 채 별도 플래그로만 멈춥니다. status를
  // 바꾸면 아래 게임 루프 effect가 정리(cleanup)되면서 engine.stop()이
  // 불려 오디오·노트 진행 상태가 통째로 사라지기 때문입니다. 대신
  // AudioContext 자체를 suspend해서 오디오 클럭(currentSongTimeMs)을
  // 얼리고, rAF 루프도 이 플래그를 보고 판정·그리기를 건너뜁니다.
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  function togglePause() {
    if (statusRef.current !== 'playing') return;
    const engine = audioEngineRef.current;
    if (!engine) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) engine.suspend();
    else engine.resume();
  }

  function attemptLaneHit(lane: number) {
    if (statusRef.current !== 'playing' || pausedRef.current) return;
    hitLaneRef.current?.(lane);
  }

  // 입력: 곡 선택은 아래 곡 버튼 탭으로만 합니다(idle에 화면 아무 데나
  // 눌러서 시작하는 동작은 없앴습니다 — 어떤 곡이 시작될지 예측 불가능해서).
  // Space/R은 종료 화면에서 방금 곡을 다시 시작하는 단축키입니다. D/F/J/K는
  // 각 레인 판정에 즉시 사용됩니다(정확도를 위해 오디오 클럭을 이 이벤트
  // 시점에 바로 읽어야 하므로, 실제 판정 로직은 아래 게임 루프 effect가
  // hitLaneRef에 심어둔 함수를 그 자리에서 호출합니다).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const laneIndex = LANE_KEY_CODES.indexOf(e.code as (typeof LANE_KEY_CODES)[number]);
      if (laneIndex !== -1) {
        e.preventDefault();
        if (!pressedLanesRef.current.has(laneIndex)) setLanePressed(laneIndex, true);
        attemptLaneHit(laneIndex);
        return;
      }
      if (e.code === 'Space' || e.key === 'r' || e.key === 'R') {
        if (statusRef.current === 'over') {
          e.preventDefault();
          restartSelected();
        }
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (statusRef.current === 'playing') {
          e.preventDefault();
          togglePause();
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const laneIndex = LANE_KEY_CODES.indexOf(e.code as (typeof LANE_KEY_CODES)[number]);
      if (laneIndex !== -1) setLanePressed(laneIndex, false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 게임 루프 =====
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const canvas = canvasRef.current;
    // alpha: false — 배경을 매 프레임 꽉 채워 그리므로 투명도 합성이 필요
    // 없습니다. 이걸 꺼두면 브라우저가 매 프레임 알파 블렌딩을 건너뛸 수
    // 있어 모바일에서 특히 체감되는 최적화입니다.
    const ctx = canvas?.getContext('2d', { alpha: false });
    const engine = audioEngineRef.current;
    const song = selectedSongRef.current;
    if (!canvas || !ctx || !engine || !song) return undefined;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    setScore(0);
    setCombo(0);
    setNewRecord(false);
    setJudgmentCounts({ perfect: 0, great: 0, good: 0, miss: 0 });
    pausedRef.current = false;
    setPaused(false);

    const notes: NoteState[] = song.charts[selectedDifficultyRef.current].map((n) => ({ ...n, judged: false, tier: null }));
    let scoreLocal = 0;
    let comboLocal = 0;
    const counts: Record<JudgmentTier, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
    let effects: Effect[] = [];
    let effectId = 0;

    function spawnEffect(lane: number, tier: JudgmentTier) {
      effects.push({ id: effectId++, lane, text: JUDGMENT_LABEL[tier], tier, createdAt: performance.now() });
    }

    function applyJudgment(note: NoteState, tier: JudgmentTier) {
      note.judged = true;
      note.tier = tier;
      counts[tier] += 1;
      comboLocal = tier === 'miss' ? 0 : comboLocal + 1;
      scoreLocal += getJudgmentPoints(tier, comboLocal);
      setScore(Math.round(scoreLocal));
      setCombo(comboLocal);
      setComboBumpKey((k) => k + 1);
      setJudgmentCounts({ ...counts });
      const judged = counts.perfect + counts.great + counts.good + counts.miss;
      const acc = judged === 0 ? 100 : ((counts.perfect * 100 + counts.great * 70 + counts.good * 30) / (judged * 100)) * 100;
      setAccuracy(Math.round(acc * 10) / 10);
      spawnEffect(note.lane, tier);
      if (tier === 'miss') engine!.playMissBlip();
      else engine!.playHitBlip();
    }

    hitLaneRef.current = (lane: number) => {
      const hitTime = engine!.currentSongTimeMs;
      let bestNote: NoteState | null = null;
      let bestDiff = Infinity;
      for (const n of notes) {
        if (n.judged || n.lane !== lane) continue;
        const diff = Math.abs(hitTime - n.time);
        if (diff <= GOOD_WINDOW_MS && diff < bestDiff) {
          bestNote = n;
          bestDiff = diff;
        }
      }
      if (!bestNote) return;
      applyJudgment(bestNote, judgeHit(bestNote.time, hitTime));
    };

    function endGame() {
      setStatus('over');
    }

    // 배경 그라디언트는 캔버스 크기가 안 바뀌니 한 번만 만들어 두고
    // 매 프레임 재사용합니다(createLinearGradient는 프레임마다 부르면
    // 그 자체로 할당 비용이 쌓입니다).
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGradient.addColorStop(0, '#161221');
    bgGradient.addColorStop(1, '#050308');

    function draw(now: number, currentTime: number, drawStart: number) {
      ctx!.fillStyle = bgGradient;
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      for (let lane = 0; lane < LANE_COUNT; lane += 1) {
        const x = laneX(lane);
        ctx!.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, CANVAS_HEIGHT);
        ctx!.stroke();
      }

      ctx!.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(0, JUDGMENT_LINE_Y);
      ctx!.lineTo(CANVAS_WIDTH, JUDGMENT_LINE_Y);
      ctx!.stroke();

      for (let i = drawStart; i < notes.length; i += 1) {
        const note = notes[i];
        if (note.judged) continue;
        const timeUntilHit = note.time - currentTime;
        // notes는 시간순 정렬이라, 아직 화면에 나타날 시점도 안 된 노트를
        // 만나면 그 뒤는 전부 더 나중 노트뿐입니다 — 더 볼 필요 없이 멈춥니다.
        if (timeUntilHit > NOTE_TRAVEL_MS) break;
        if (timeUntilHit < -GOOD_WINDOW_MS) continue;
        const progress = 1 - timeUntilHit / NOTE_TRAVEL_MS;
        const y = progress * JUDGMENT_LINE_Y;
        ctx!.fillStyle = LANE_COLORS[note.lane];
        ctx!.beginPath();
        ctx!.arc(laneX(note.lane), y, NOTE_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
      }

      for (let lane = 0; lane < LANE_COUNT; lane += 1) {
        const isPressed = pressedLanesRef.current.has(lane);
        ctx!.fillStyle = isPressed ? LANE_COLORS[lane] : 'rgba(255,255,255,0.15)';
        ctx!.globalAlpha = isPressed ? 0.9 : 1;
        ctx!.beginPath();
        ctx!.arc(laneX(lane), JUDGMENT_LINE_Y, NOTE_RADIUS + (isPressed ? 9 : 6), 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      effects = effects.filter((fx) => now - fx.createdAt < 500);
      effects.forEach((fx) => {
        const t = (now - fx.createdAt) / 500;
        ctx!.globalAlpha = 1 - t;
        ctx!.fillStyle = fx.tier === 'miss' ? '#ff6b6b' : fx.tier === 'perfect' ? '#ffd43b' : '#fff';
        ctx!.font = 'bold 16px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText(fx.text, laneX(fx.lane), JUDGMENT_LINE_Y - 30 - t * 20);
        ctx!.globalAlpha = 1;
      });
    }

    // notes는 시간순 정렬이라, 이미 판정이 끝난 앞쪽 노트들은 매 프레임 다시
    // 훑을 필요가 없습니다. 이 커서를 판정 끝난 만큼만 전진시켜, 곡 후반부로
    // 갈수록(이미 지나간 노트가 수백 개씩 쌓일수록) 매 프레임 배열 전체를
    // 스캔하던 비용을 없앱니다 — 저사양 폰에서 노트 애니메이션이 끊기던
    // 원인 중 하나였습니다.
    let activeStart = 0;

    let rafId = 0;
    function tick(now: number) {
      // suspend()로 오디오 클럭이 멈춰 있는 동안은 판정도 그리기도 건너뛰고
      // rAF만 유지합니다(resume() 즉시 매끄럽게 이어지도록).
      if (pausedRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const currentTime = engine!.currentSongTimeMs;

      while (activeStart < notes.length && notes[activeStart].judged) activeStart += 1;

      for (let i = activeStart; i < notes.length; i += 1) {
        const note = notes[i];
        if (note.judged) continue;
        if (note.time - currentTime > NOTE_TRAVEL_MS) break;
        if (currentTime - note.time > GOOD_WINDOW_MS) {
          applyJudgment(note, 'miss');
        }
      }

      draw(now, currentTime, activeStart);

      if (currentTime >= song!.durationMs) {
        endGame();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      hitLaneRef.current = null;
      engine.stop();
      if (audioEngineRef.current === engine) audioEngineRef.current = null;
    };
  }, [status]);

  // 게임오버 시 최고 기록 갱신 + 로그인 상태면 서버에 점수 제출.
  useEffect(() => {
    if (status !== 'over') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest((prevBest) => {
      if (score > prevBest) {
        setNewRecord(true);
        return score;
      }
      return prevBest;
    });

    if (!currentUser || score === 0) return;
    requestJson(LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    })
      .then(() => mutateLeaderboard())
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="rhythm">
      <p className="rhythm__desc">
        D/F/J/K 또는 아래 버튼 탭으로 판정선에 닿는 순간 노트를 맞추세요. 모여밥 실제 BGM으로 플레이할 수 있어요.
      </p>

      <div className="rhythm__canvas-wrap">
        <canvas className="rhythm__canvas" height={CANVAS_HEIGHT} ref={canvasRef} width={CANVAS_WIDTH} />

        {status === 'playing' && (
          <div className="rhythm__hud">
            <span>Score: {score}</span>
            <span key={comboBumpKey} className="rhythm__hud-combo">
              Combo x{combo}
            </span>
            <span>{accuracy.toFixed(1)}%</span>
            <button className="rhythm__pause-btn" onClick={togglePause} type="button">
              {paused ? '▶' : '⏸'}
            </button>
          </div>
        )}

        {status === 'playing' && paused && (
          <div className="rhythm__overlay">
            <p className="rhythm__overlay-title">일시정지</p>
            <div className="rhythm__overlay-actions">
              <button className="rhythm__restart-btn" onClick={togglePause} type="button">
                계속하기 (P)
              </button>
              <button
                className="rhythm__secondary-btn"
                onClick={() => {
                  pausedRef.current = false;
                  setPaused(false);
                  setPickingSong(null);
                  setStatus('idle');
                }}
                type="button"
              >
                곡 다시 고르기
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && pickingSong === null && (
          <div className="rhythm__overlay">
            <p className="rhythm__overlay-title">곡을 선택하세요</p>
            {loadError && <p className="rhythm__overlay-error">{loadError}</p>}
            <div className="rhythm__song-list">
              {RHYTHM_SONGS.map((song) => (
                <button
                  className="rhythm__song-btn"
                  key={song.id}
                  onClick={() => setPickingSong(song)}
                  type="button"
                >
                  <span className="rhythm__song-btn-label">{song.label}</span>
                  <span className="rhythm__song-btn-meta">
                    {Math.round(song.bpm)} BPM · {Math.round(song.durationMs / 1000)}초
                  </span>
                </button>
              ))}
            </div>
            <p className="rhythm__overlay-hint">D / F / J / K 로 노트를 맞춰요</p>
          </div>
        )}

        {status === 'idle' && pickingSong !== null && (
          <div className="rhythm__overlay">
            <p className="rhythm__overlay-title">{pickingSong.label}</p>
            <p className="rhythm__overlay-hint">난이도를 선택하세요</p>
            {loadError && <p className="rhythm__overlay-error">{loadError}</p>}
            <div className="rhythm__song-list">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  className={`rhythm__song-btn rhythm__song-btn--${DIFFICULTY_STYLE[difficulty]}`}
                  key={difficulty}
                  onClick={() => void startGame(pickingSong, difficulty)}
                  type="button"
                >
                  <span className="rhythm__song-btn-label">{DIFFICULTY_LABEL[difficulty]}</span>
                </button>
              ))}
            </div>
            <button className="rhythm__secondary-btn" onClick={() => setPickingSong(null)} type="button">
              ← 곡 다시 고르기
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="rhythm__overlay">
            <p className="rhythm__overlay-title">불러오는 중...</p>
          </div>
        )}

        {status === 'over' && (
          <div className="rhythm__overlay">
            <p className="rhythm__overlay-title">CLEAR!</p>
            {newRecord && <p className="rhythm__overlay-record">NEW RECORD!</p>}
            <p className="rhythm__overlay-line">Score: {score}</p>
            <p className="rhythm__overlay-line">Best: {best}</p>
            <p className="rhythm__overlay-line">정확도: {accuracy.toFixed(1)}%</p>
            <p className="rhythm__overlay-line">
              P {judgmentCounts.perfect} · G {judgmentCounts.great} · G {judgmentCounts.good} · M {judgmentCounts.miss}
            </p>
            <div className="rhythm__overlay-actions">
              <button className="rhythm__restart-btn" onClick={restartSelected} type="button">
                다시 시작 (R)
              </button>
              <button
                className="rhythm__secondary-btn"
                onClick={() => {
                  setPickingSong(null);
                  setStatus('idle');
                }}
                type="button"
              >
                곡 다시 고르기
              </button>
            </div>
          </div>
        )}

        {status === 'playing' && (
          <div className="rhythm__lane-buttons">
            {LANE_LABELS.map((label, index) => (
              <button
                className={`rhythm__lane-btn ${pressedLanes.has(index) ? 'rhythm__lane-btn--pressed' : ''}`}
                key={label}
                // 클릭(pointerup 이후)이 아니라 pointerdown에서 바로
                // 판정합니다 — 안 그러면 실제 입력 시각과 판정 시각 사이에
                // 사람이 느낄 만한 지연이 생깁니다.
                onPointerCancel={() => setLanePressed(index, false)}
                onPointerDown={() => {
                  setLanePressed(index, true);
                  attemptLaneHit(index);
                }}
                onPointerLeave={() => setLanePressed(index, false)}
                onPointerUp={() => setLanePressed(index, false)}
                style={{ borderColor: LANE_COLORS[index] }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rhythm__leaderboard">
        <p className="rhythm__leaderboard-title">🏆 이번 주 랭킹 (최고 점수 Top 10)</p>
        <WeekNote week={leaderboardData?.week} />
        {!currentUser && <p className="rhythm__leaderboard-note">로그인하면 내 최고 점수가 랭킹에 기록돼요.</p>}
        {leaderboardData && leaderboardData.leaderboard.length === 0 && (
          <p className="rhythm__leaderboard-note">아직 기록이 없어요. 첫 기록을 남겨보세요!</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <ol className="rhythm__leaderboard-list">
            {leaderboardData.leaderboard.map((entry) => (
              <li
                className={`rhythm__leaderboard-item ${currentUser?.id === entry.userId ? 'rhythm__leaderboard-item--me' : ''} ${rankRowClass(entry.rank)}`}
                key={entry.userId}
              >
                <RankMedal rank={entry.rank} className="rhythm__leaderboard-rank" />
                <span className="rhythm__leaderboard-name">{entry.userName}</span>
                <span className="rhythm__leaderboard-score">{entry.bestScore}</span>
              </li>
            ))}
          </ol>
        )}
        {currentUser && leaderboardData?.myRank && (
          <p className="rhythm__leaderboard-my-rank">내 순위: {leaderboardData.myRank}위</p>
        )}
        <HallOfFame hall={leaderboardData?.hall} unit="점" />
      </div>
    </div>
  );
}
