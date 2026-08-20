'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { requestJson } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

const GAME_KEY = 'snake';
const LEADERBOARD_URL = `/api/games/${GAME_KEY}/scores`;

type ScoreEntry = { userId: string; userName: string; bestScore: number };
type LeaderboardResponse = { leaderboard: ScoreEntry[]; myRank: number | null };

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const TICK_MS = 130;

type Point = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type Status = 'idle' | 'playing' | 'over';

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function initialSnake(): Point[] {
  const y = Math.floor(GRID_SIZE / 2);
  return [
    { x: 8, y },
    { x: 7, y },
    { x: 6, y },
  ];
}

function randomEmptyCell(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  let cell: Point;
  do {
    cell = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
  } while (occupied.has(`${cell.x},${cell.y}`));
  return cell;
}

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingDirectionRef = useRef<Direction>('right');
  const { currentUser } = useAuth();
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR<LeaderboardResponse>(
    LEADERBOARD_URL,
    fetcher,
  );

  const [status, setStatus] = useState<Status>('idle');
  const [snake, setSnake] = useState<Point[]>(() => initialSnake());
  const [direction, setDirection] = useState<Direction>('right');
  const [food, setFood] = useState<Point | null>(null);
  const [score, setScore] = useState(0);

  function handleStart() {
    const startSnake = initialSnake();
    pendingDirectionRef.current = 'right';
    setSnake(startSnake);
    setDirection('right');
    setFood(randomEmptyCell(startSnake));
    setScore(0);
    setStatus('playing');
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const nextDirection = KEY_TO_DIRECTION[event.key];
      if (!nextDirection) return;
      event.preventDefault();
      if (nextDirection === OPPOSITE[direction]) return;
      pendingDirectionRef.current = nextDirection;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    if (status !== 'playing' || !food) return;

    const timer = setTimeout(() => {
      const nextDirection = pendingDirectionRef.current;
      const head = snake[0];
      const delta = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      }[nextDirection];
      const newHead: Point = { x: head.x + delta.x, y: head.y + delta.y };

      const hitWall = newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE;
      const ateFood = food.x === newHead.x && food.y === newHead.y;
      const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
      const hitSelf = bodyToCheck.some((segment) => segment.x === newHead.x && segment.y === newHead.y);

      if (hitWall || hitSelf) {
        setStatus('over');
        return;
      }

      const nextSnake = ateFood ? [newHead, ...snake] : [newHead, ...snake.slice(0, -1)];
      setDirection(nextDirection);
      setSnake(nextSnake);
      if (ateFood) {
        setScore((prev) => prev + 1);
        setFood(randomEmptyCell(nextSnake));
      }
    }, TICK_MS);

    return () => clearTimeout(timer);
  }, [status, snake, food]);

  useEffect(() => {
    if (status !== 'over' || !currentUser || score === 0) return;

    requestJson(LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    })
      .then(() => mutateLeaderboard())
      .catch(() => null);
    // 게임오버 진입 시 한 번만 제출하면 되므로 status 변화에만 반응합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#1a2634';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (food) {
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.roundRect(food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
      ctx.fill();
    }

    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#95e1d3' : '#4ecdc4';
      ctx.beginPath();
      ctx.roundRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
      ctx.fill();
    });
  }, [snake, food]);

  return (
    <div className="snake">
      <p className="snake__desc">방향키로 뱀을 조작해서 먹이를 먹으세요. 벽이나 몸에 부딪히면 끝나요.</p>

      <div className="snake__score">점수: {score}</div>

      <div className="snake__canvas-wrap">
        <canvas className="snake__canvas" height={CANVAS_SIZE} ref={canvasRef} width={CANVAS_SIZE} />

        {status !== 'playing' && (
          <div className="snake__overlay">
            {status === 'over' ? (
              <>
                <p className="snake__overlay-title">게임 종료</p>
                <p className="snake__overlay-score">점수: {score}</p>
              </>
            ) : (
              <p className="snake__overlay-title">방향키로 시작해보세요</p>
            )}
            <button className="snake__start-btn" onClick={handleStart} type="button">
              {status === 'over' ? '다시 시작' : '시작하기'}
            </button>
          </div>
        )}
      </div>

      <div className="snake__leaderboard">
        <p className="snake__leaderboard-title">🏆 랭킹 (최고 점수)</p>
        {!currentUser && (
          <p className="snake__leaderboard-note">로그인하면 내 최고 점수가 랭킹에 기록돼요.</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length === 0 && (
          <p className="snake__leaderboard-note">아직 기록이 없어요. 첫 기록을 남겨보세요!</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <ol className="snake__leaderboard-list">
            {leaderboardData.leaderboard.map((entry, index) => (
              <li
                className={`snake__leaderboard-item ${currentUser?.id === entry.userId ? 'snake__leaderboard-item--me' : ''}`}
                key={entry.userId}
              >
                <span className="snake__leaderboard-rank">{index + 1}</span>
                <span className="snake__leaderboard-name">{entry.userName}</span>
                <span className="snake__leaderboard-score">{entry.bestScore}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
