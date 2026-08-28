'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { requestJson } from '../../lib/api-client';
import { RhythmAudioEngine } from '../../lib/rhythm/audio';
import { RHYTHM_SONGS, type RhythmSong } from '../../lib/rhythm/charts.generated';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GOOD_WINDOW_MS,
  JUDGMENT_LINE_Y,
  LANE_COUNT,
  LANE_KEYS,
  LANE_LABELS,
  NOTE_RADIUS,
  NOTE_TRAVEL_MS,
} from '../../lib/rhythm/constants';
import { getJudgmentPoints, judgeHit } from '../../lib/rhythm/judgment';
import type { JudgmentTier } from '../../lib/rhythm/types';
import { useAuth } from './AuthProvider';

const GAME_KEY = 'rhythm';
const LEADERBOARD_URL = `/api/games/${GAME_KEY}/scores`;

type ScoreEntry = { userId: string; userName: string; bestScore: number };
type LeaderboardResponse = { leaderboard: ScoreEntry[]; myRank: number | null };
type Status = 'idle' | 'loading' | 'playing' | 'over';

type NoteState = { id: number; time: number; lane: number; judged: boolean; tier: JudgmentTier | null };
type Effect = { id: number; lane: number; text: string; tier: JudgmentTier; createdAt: number };

const LANE_COLORS = ['#ff6b6b', '#ffd43b', '#4dd4ff', '#c77dff'];
const JUDGMENT_LABEL: Record<JudgmentTier, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };

function laneX(lane: number): number {
  return (CANVAS_WIDTH / (LANE_COUNT + 1)) * (lane + 1);
}

export function RhythmGame() {
  const { currentUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR<LeaderboardResponse>(
    LEADERBOARD_URL,
    fetcher,
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !leaderboardData) return;
    const mine = leaderboardData.leaderboard.find((entry) => entry.userId === currentUser.id);
    if (mine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBest((prev) => Math.max(prev, mine.bestScore));
    }
  }, [leaderboardData, currentUser]);

  async function startGame(song: RhythmSong) {
    const statusBefore: Status = statusRef.current;
    if (statusBefore === 'playing' || statusBefore === 'loading') return;
    audioEngineRef.current?.stop();
    selectedSongRef.current = song;
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
    if (selectedSongRef.current) void startGame(selectedSongRef.current);
  }

  function attemptLaneHit(lane: number) {
    if (statusRef.current !== 'playing') return;
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
      const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase() as (typeof LANE_KEYS)[number]);
      if (laneIndex !== -1) {
        e.preventDefault();
        attemptLaneHit(laneIndex);
        return;
      }
      if (e.code === 'Space' || e.key === 'r' || e.key === 'R') {
        if (statusRef.current === 'over') {
          e.preventDefault();
          restartSelected();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 게임 루프 =====
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const engine = audioEngineRef.current;
    const song = selectedSongRef.current;
    if (!canvas || !ctx || !engine || !song) return undefined;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    setScore(0);
    setCombo(0);
    setNewRecord(false);
    setJudgmentCounts({ perfect: 0, great: 0, good: 0, miss: 0 });

    const notes: NoteState[] = song.chart.map((n) => ({ ...n, judged: false, tier: null }));
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

    function draw(now: number, currentTime: number) {
      const gradient = ctx!.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#161221');
      gradient.addColorStop(1, '#050308');
      ctx!.fillStyle = gradient;
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

      for (const note of notes) {
        if (note.judged) continue;
        const timeUntilHit = note.time - currentTime;
        if (timeUntilHit > NOTE_TRAVEL_MS || timeUntilHit < -GOOD_WINDOW_MS) continue;
        const progress = 1 - timeUntilHit / NOTE_TRAVEL_MS;
        const y = progress * JUDGMENT_LINE_Y;
        ctx!.fillStyle = LANE_COLORS[note.lane];
        ctx!.beginPath();
        ctx!.arc(laneX(note.lane), y, NOTE_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
      }

      for (let lane = 0; lane < LANE_COUNT; lane += 1) {
        ctx!.fillStyle = 'rgba(255,255,255,0.15)';
        ctx!.beginPath();
        ctx!.arc(laneX(lane), JUDGMENT_LINE_Y, NOTE_RADIUS + 6, 0, Math.PI * 2);
        ctx!.fill();
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

    let rafId = 0;
    function tick(now: number) {
      const currentTime = engine!.currentSongTimeMs;

      for (const note of notes) {
        if (note.judged) continue;
        if (currentTime - note.time > GOOD_WINDOW_MS) {
          applyJudgment(note, 'miss');
        }
      }

      draw(now, currentTime);

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
        D/F/J/K 또는 아래 버튼 탭으로 판정선에 닿는 순간 노트를 맞추세요. 모여밥 실제 BGM 3곡 중 골라서 플레이할 수 있어요.
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
          </div>
        )}

        {status === 'idle' && (
          <div className="rhythm__overlay">
            <p className="rhythm__overlay-title">곡을 선택하세요</p>
            {loadError && <p className="rhythm__overlay-error">{loadError}</p>}
            <div className="rhythm__song-list">
              {RHYTHM_SONGS.map((song) => (
                <button
                  className="rhythm__song-btn"
                  key={song.id}
                  onClick={() => void startGame(song)}
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
              <button className="rhythm__secondary-btn" onClick={() => setStatus('idle')} type="button">
                곡 다시 고르기
              </button>
            </div>
          </div>
        )}

        {status === 'playing' && (
          <div className="rhythm__lane-buttons">
            {LANE_LABELS.map((label, index) => (
              <button
                className="rhythm__lane-btn"
                key={label}
                onClick={() => attemptLaneHit(index)}
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
        <p className="rhythm__leaderboard-title">🏆 랭킹 (최고 점수 Top 10)</p>
        {!currentUser && <p className="rhythm__leaderboard-note">로그인하면 내 최고 점수가 랭킹에 기록돼요.</p>}
        {leaderboardData && leaderboardData.leaderboard.length === 0 && (
          <p className="rhythm__leaderboard-note">아직 기록이 없어요. 첫 기록을 남겨보세요!</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <ol className="rhythm__leaderboard-list">
            {leaderboardData.leaderboard.map((entry, index) => (
              <li
                className={`rhythm__leaderboard-item ${currentUser?.id === entry.userId ? 'rhythm__leaderboard-item--me' : ''}`}
                key={entry.userId}
              >
                <span className="rhythm__leaderboard-rank">{index + 1}</span>
                <span className="rhythm__leaderboard-name">{entry.userName}</span>
                <span className="rhythm__leaderboard-score">{entry.bestScore}</span>
              </li>
            ))}
          </ol>
        )}
        {currentUser && leaderboardData?.myRank && (
          <p className="rhythm__leaderboard-my-rank">내 순위: {leaderboardData.myRank}위</p>
        )}
      </div>
    </div>
  );
}
