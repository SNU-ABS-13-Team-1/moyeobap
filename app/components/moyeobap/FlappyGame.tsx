'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { HallOfFame, type HallWeek } from './HallOfFame';
import { RankMedal, rankRowClass } from './RankMedal';
import { WeekNote, type WeekInfo } from './WeekNote';
import { requestJson } from '../../lib/api-client';
import {
  BIRD_COLLISION_RADIUS,
  BIRD_RADIUS,
  BIRD_X,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MOVING_OBSTACLE_AMPLITUDE_RATIO,
  MOVING_OBSTACLE_ANGULAR_SPEED,
  MOVING_OBSTACLE_RADIUS,
  PIPE_WIDTH,
} from '../../lib/flappy/constants';
import { applyGravity, circleCollides, circleRectCollides, flapVelocity, getBirdRotation, updatePosition } from '../../lib/flappy/physics';
import { getPipeSpeed } from '../../lib/flappy/difficulty';
import { createObstacleGenerator, type Pipe } from '../../lib/flappy/obstacles';
import { evaluatePass, getComboMultiplier } from '../../lib/flappy/scoring';
import { useAuth } from './AuthProvider';

const GAME_KEY = 'flappy';
const LEADERBOARD_URL = `/api/games/${GAME_KEY}/scores`;

type ScoreEntry = { userId: string; userName: string; bestScore: number };
type LeaderboardResponse = { leaderboard: ScoreEntry[]; myRank: number | null; week?: WeekInfo; hall?: HallWeek[] };
type Status = 'idle' | 'playing' | 'over';

type Effect = { id: number; x: number; y: number; text: string; perfect: boolean; createdAt: number };

function pad3(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(3, '0');
}

function getBackgroundColors(score: number): [string, string] {
  if (score < 30) return ['#7ec8e3', '#dff3ff'];
  if (score < 60) return ['#f4a261', '#ffd6a5'];
  if (score < 100) return ['#5c4d7d', '#241b35'];
  return ['#1a0e1e', '#050208'];
}

export function FlappyGame() {
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
  const [newRecord, setNewRecord] = useState(false);

  const statusRef = useRef<Status>('idle');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const flapQueuedRef = useRef(false);

  useEffect(() => {
    if (!currentUser || !leaderboardData) return;
    const mine = leaderboardData.leaderboard.find((entry) => entry.userId === currentUser.id);
    if (mine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBest((prev) => Math.max(prev, mine.bestScore));
    }
  }, [leaderboardData, currentUser]);

  // 입력: Space/클릭/터치는 idle이면 시작, playing이면 flap 예약. R은
  // gameover에서만 재시작합니다.
  useEffect(() => {
    function requestFlapOrStart() {
      if (statusRef.current === 'idle') {
        setStatus('playing');
      } else if (statusRef.current === 'playing') {
        flapQueuedRef.current = true;
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        requestFlapOrStart();
      } else if (e.key === 'r' || e.key === 'R') {
        if (statusRef.current === 'over') setStatus('playing');
      }
    }
    function onPointerDown(e: PointerEvent) {
      // 재시작/게임오버 버튼 클릭이 flap으로 이중 처리되지 않도록 버튼은 제외합니다.
      if ((e.target as HTMLElement)?.closest('button')) return;
      requestFlapOrStart();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  // ===== 게임 루프 =====
  // 새/파이프 위치는 매 프레임 바뀌므로 React state가 아니라 이 effect
  // 안의 지역 변수로 관리하고(리렌더 방지), 점수·콤보처럼 HUD에 필요한
  // 값만 이벤트(파이프 통과, 충돌) 시점에 setState로 반영합니다.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 새 판을 시작할 때 HUD도 함께 초기화합니다.
    setScore(0);
    setCombo(0);
    setNewRecord(false);

    let birdY = CANVAS_HEIGHT / 2;
    let birdVY = 0;
    let scoreLocal = 0;
    let comboLocal = 0;
    let pipes: Pipe[] = [];
    let effects: Effect[] = [];
    let effectId = 0;
    let perfectFlashUntil = 0;
    const generator = createObstacleGenerator();
    generator.reset();

    let lastTime = performance.now();
    let elapsed = 0;
    let rafId = 0;

    function spawnEffect(x: number, y: number, text: string, perfect: boolean) {
      effects.push({ id: effectId++, x, y, text, perfect, createdAt: performance.now() });
    }

    function endGame() {
      setScore(scoreLocal);
      setStatus('over');
    }

    function draw() {
      const [top, bottom] = getBackgroundColors(scoreLocal);
      const gradient = ctx!.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      pipes.forEach((pipe) => {
        ctx!.fillStyle = '#2f9e44';
        ctx!.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY);
        ctx!.fillRect(pipe.x, pipe.gapY + pipe.gapHeight, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.gapY + pipe.gapHeight));
        ctx!.fillStyle = '#2b8a3e';
        ctx!.fillRect(pipe.x - 3, pipe.gapY - 18, PIPE_WIDTH + 6, 18);
        ctx!.fillRect(pipe.x - 3, pipe.gapY + pipe.gapHeight, PIPE_WIDTH + 6, 18);

        if (pipe.hasMovingObstacle) {
          const center = pipe.gapY + pipe.gapHeight / 2;
          const amplitude = pipe.gapHeight * MOVING_OBSTACLE_AMPLITUDE_RATIO;
          const oy = center + Math.sin(pipe.movingObstaclePhase + elapsed * MOVING_OBSTACLE_ANGULAR_SPEED) * amplitude;
          ctx!.fillStyle = '#e03131';
          ctx!.beginPath();
          ctx!.arc(pipe.x + PIPE_WIDTH / 2, oy, MOVING_OBSTACLE_RADIUS, 0, Math.PI * 2);
          ctx!.fill();
        }
      });

      // 새(회전 + 부리/눈)
      ctx!.save();
      ctx!.translate(BIRD_X, birdY);
      ctx!.rotate(getBirdRotation(birdVY));
      ctx!.fillStyle = '#ffd43b';
      ctx!.beginPath();
      ctx!.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#f76707';
      ctx!.beginPath();
      ctx!.moveTo(BIRD_RADIUS - 2, -3);
      ctx!.lineTo(BIRD_RADIUS + 9, 0);
      ctx!.lineTo(BIRD_RADIUS - 2, 5);
      ctx!.fill();
      ctx!.fillStyle = '#212529';
      ctx!.beginPath();
      ctx!.arc(4, -5, 2.6, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      const now = performance.now();
      effects = effects.filter((fx) => now - fx.createdAt < 700);
      effects.forEach((fx) => {
        const t = (now - fx.createdAt) / 700;
        ctx!.globalAlpha = 1 - t;
        ctx!.fillStyle = fx.perfect ? '#ffd43b' : '#ffffff';
        ctx!.font = fx.perfect ? 'bold 22px sans-serif' : 'bold 16px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText(fx.text, fx.x, fx.y - t * 30);
        ctx!.globalAlpha = 1;
      });

      if (now < perfectFlashUntil) {
        const t = (perfectFlashUntil - now) / 150;
        ctx!.fillStyle = `rgba(255,255,255,${0.35 * t})`;
        ctx!.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

    }

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      elapsed += dt;

      if (flapQueuedRef.current) {
        flapQueuedRef.current = false;
        birdVY = flapVelocity();
      }
      birdVY = applyGravity(birdVY, dt);
      birdY = updatePosition(birdY, birdVY, dt);

      const speed = getPipeSpeed(scoreLocal);

      if (pipes.length === 0 || pipes[pipes.length - 1].x <= CANVAS_WIDTH - 250) {
        pipes.push(generator.next(scoreLocal));
      }

      pipes.forEach((pipe) => {
        pipe.x -= speed * dt;
      });
      pipes = pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -50);

      // 충돌: 화면 위/아래 경계
      if (birdY - BIRD_COLLISION_RADIUS <= 0 || birdY + BIRD_COLLISION_RADIUS >= CANVAS_HEIGHT) {
        draw();
        endGame();
        return;
      }

      // 충돌: 파이프 / 이동 장애물
      for (const pipe of pipes) {
        if (pipe.x > BIRD_X + BIRD_COLLISION_RADIUS || pipe.x + PIPE_WIDTH < BIRD_X - BIRD_COLLISION_RADIUS) continue;

        const hitsTop = circleRectCollides(BIRD_X, birdY, BIRD_COLLISION_RADIUS, pipe.x, 0, PIPE_WIDTH, pipe.gapY);
        const hitsBottom = circleRectCollides(
          BIRD_X,
          birdY,
          BIRD_COLLISION_RADIUS,
          pipe.x,
          pipe.gapY + pipe.gapHeight,
          PIPE_WIDTH,
          CANVAS_HEIGHT - (pipe.gapY + pipe.gapHeight),
        );
        if (hitsTop || hitsBottom) {
          draw();
          endGame();
          return;
        }

        if (pipe.hasMovingObstacle) {
          const center = pipe.gapY + pipe.gapHeight / 2;
          const amplitude = pipe.gapHeight * MOVING_OBSTACLE_AMPLITUDE_RATIO;
          const oy = center + Math.sin(pipe.movingObstaclePhase + elapsed * MOVING_OBSTACLE_ANGULAR_SPEED) * amplitude;
          if (circleCollides(BIRD_X, birdY, BIRD_COLLISION_RADIUS, pipe.x + PIPE_WIDTH / 2, oy, MOVING_OBSTACLE_RADIUS)) {
            draw();
            endGame();
            return;
          }
        }
      }

      // 통과 판정
      for (const pipe of pipes) {
        if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X - BIRD_COLLISION_RADIUS) {
          pipe.scored = true;
          comboLocal += 1;
          const result = evaluatePass(birdY, pipe.gapY, pipe.gapHeight, comboLocal);
          scoreLocal += result.totalPoints;
          spawnEffect(BIRD_X, birdY - 20, result.perfect ? 'PERFECT!' : `+${result.totalPoints}`, result.perfect);
          if (result.perfect) perfectFlashUntil = performance.now() + 150;
          setScore(scoreLocal);
          setCombo(comboLocal);
          setComboBumpKey((k) => k + 1);
        }
      }

      draw();
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
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
    // 게임오버 진입 시 한 번만 실행하면 되므로 status 변화에만 반응합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const multiplier = getComboMultiplier(combo);

  return (
    <div className="flappy">
      <p className="flappy__desc">Space / 클릭 / 터치로 flap하세요. 파이프 사이를 아슬아슬하게 지날수록 점수가 높아져요.</p>

      <div className="flappy__canvas-wrap">
        <canvas className="flappy__canvas" height={CANVAS_HEIGHT} ref={canvasRef} width={CANVAS_WIDTH} />

        {status === 'playing' && (
          <div className="flappy__hud">
            <span>Score: {pad3(score)}</span>
            <span>Best: {pad3(best)}</span>
            <span key={comboBumpKey} className="flappy__hud-combo">
              Combo: x{combo}
            </span>
            <span>Multiplier: x{multiplier.toFixed(1)}</span>
          </div>
        )}

        {status === 'idle' && (
          <div className="flappy__overlay">
            <p className="flappy__overlay-title">PRESS SPACE TO START</p>
            <p className="flappy__overlay-hint">클릭 / 터치로도 시작할 수 있어요</p>
          </div>
        )}

        {status === 'over' && (
          <div className="flappy__overlay">
            <p className="flappy__overlay-title">GAME OVER</p>
            {newRecord && <p className="flappy__overlay-record">NEW RECORD!</p>}
            <p className="flappy__overlay-line">Score: {score}</p>
            <p className="flappy__overlay-line">Best: {best}</p>
            <p className="flappy__overlay-line">Combo: {combo}</p>
            <button className="flappy__restart-btn" onClick={() => setStatus('playing')} type="button">
              다시 시작 (R)
            </button>
          </div>
        )}
      </div>

      <div className="flappy__leaderboard">
        <p className="flappy__leaderboard-title">🏆 이번 주 랭킹 (최고 점수 Top 10)</p>
        <WeekNote week={leaderboardData?.week} />
        {!currentUser && <p className="flappy__leaderboard-note">로그인하면 내 최고 점수가 랭킹에 기록돼요.</p>}
        {leaderboardData && leaderboardData.leaderboard.length === 0 && (
          <p className="flappy__leaderboard-note">아직 기록이 없어요. 첫 기록을 남겨보세요!</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <ol className="flappy__leaderboard-list">
            {leaderboardData.leaderboard.map((entry, index) => (
              <li
                className={`flappy__leaderboard-item ${currentUser?.id === entry.userId ? 'flappy__leaderboard-item--me' : ''} ${rankRowClass(index + 1)}`}
                key={entry.userId}
              >
                <RankMedal rank={index + 1} className="flappy__leaderboard-rank" />
                <span className="flappy__leaderboard-name">{entry.userName}</span>
                <span className="flappy__leaderboard-score">{entry.bestScore}</span>
              </li>
            ))}
          </ol>
        )}
        {currentUser && leaderboardData?.myRank && (
          <p className="flappy__leaderboard-my-rank">내 순위: {leaderboardData.myRank}위</p>
        )}
        <HallOfFame hall={leaderboardData?.hall} unit="점" />
      </div>
    </div>
  );
}
