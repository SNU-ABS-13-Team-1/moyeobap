'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BOARD_SIZE,
  CANCEL_DRAG,
  MAX_DRAG,
  MAX_SHOT_SPEED,
  STONE_RADIUS,
  advance,
  allSettled,
  previewPath,
  toBodies,
  type Body,
  type Owner,
  type Shot,
  type Stone,
} from '../../lib/alkkagiPhysics';

// 알까기 판입니다. 그리기와 조준 입력만 맡고, 방 상태와 서버 통신은
// AlkkagiRoom이 맡습니다(안 나누면 캔버스 애니메이션까지 한 파일에 얹혀
// 1000줄을 넘습니다).
//
// 캔버스를 논리 좌표(640x640) 그대로 두고 CSS로만 줄입니다. 그래서 그릴 때는
// 좌표 변환이 필요 없고, 포인터 좌표만 논리 좌표로 되돌리면 됩니다.

/** 떨어진 돌이 사라지기까지 걸리는 시간. 이 시간이 지나야 재생이 끝납니다. */
const FALL_FADE_MS = 600;

export type Replay = { seq: number; pre: Stone[]; shot: Shot; startedAtMs: number };

export type AlkkagiBoardProps = {
  /** 서버가 확정한 현재 배치. 재생이 끝나면 이 값으로 스냅합니다. */
  stones: Stone[];
  /** 재생할 샷. seq가 바뀔 때마다 pre부터 다시 재생합니다. null이면 정지 화면. */
  replay: Replay | null;
  /** 내 색. 관전자는 흑 시점으로 봅니다. */
  viewAs: Owner;
  /** 지금 내가 칠 수 있는지(내 차례 + 진행 중 + 재생 중 아님). */
  canShoot: boolean;
  myColor: Owner | null;
  onShoot: (shot: Shot) => void;
  /** 재생이 끝났을 때(턴 표시·시계를 그때 켜기 위해). */
  onReplayEnd?: (seq: number) => void;
};

type Aim = { stoneId: string; from: { x: number; y: number }; to: { x: number; y: number } };

export function AlkkagiBoard({
  stones,
  replay,
  viewAs,
  canShoot,
  myColor,
  onShoot,
  onReplayEnd,
}: AlkkagiBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aim, setAim] = useState<Aim | null>(null);

  // 재생 중인 돌들은 상태가 아니라 ref에 둡니다. 상태로 두면 프레임마다
  // 리렌더가 돌아 애니메이션이 끊깁니다.
  const bodiesRef = useRef<Body[] | null>(null);
  const stepsRef = useRef(0);
  const replayRef = useRef<Replay | null>(null);
  const endedSeqRef = useRef<number | null>(null);

  // 그리기 루프가 항상 최신 값을 보도록 ref로 넘깁니다. 루프를 의존성으로
  // 다시 만들면 애니메이션이 끊기기 때문입니다. 렌더 도중에 ref를 쓰면 안
  // 되므로 매 렌더 뒤에 동기화합니다.
  const stonesRef = useRef(stones);
  const aimRef = useRef<Aim | null>(aim);
  const viewAsRef = useRef(viewAs);
  const onReplayEndRef = useRef(onReplayEnd);
  useEffect(() => {
    stonesRef.current = stones;
    aimRef.current = aim;
    viewAsRef.current = viewAs;
    onReplayEndRef.current = onReplayEnd;
  });

  // 새 샷이 오면 발사 전 배치부터 다시 굴립니다.
  useEffect(() => {
    if (!replay) {
      replayRef.current = null;
      bodiesRef.current = null;
      stepsRef.current = 0;
      return;
    }
    if (replayRef.current?.seq === replay.seq) return;
    replayRef.current = replay;
    const bodies = toBodies(replay.pre);
    const target = bodies.find((body) => body.id === replay.shot.stoneId);
    if (target) {
      target.vx = replay.shot.vx;
      target.vy = replay.shot.vy;
    }
    bodiesRef.current = bodies;
    stepsRef.current = 0;
    endedSeqRef.current = null;
  }, [replay]);

  useEffect(() => {
    let frame = 0;

    function draw() {
      frame = window.requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const flipped = viewAsRef.current === 'white';
      const toView = (p: { x: number; y: number }) =>
        flipped ? { x: BOARD_SIZE - p.x, y: BOARD_SIZE - p.y } : p;

      drawBoard(ctx);

      const current = replayRef.current;
      const bodies = bodiesRef.current;

      if (current && bodies) {
        // 상대 화면에서도 같은 시점이 보이도록, 서버가 찍은 발사 시각으로부터
        // 이미 지난 시간만큼 건너뛰고 이어서 그립니다. 네트워크가 느렸다고
        // 상대 화면에서만 늦게 도착하는 일이 없어집니다.
        const elapsedMs = Date.now() - current.startedAtMs;
        stepsRef.current = advance(bodies, stepsRef.current, elapsedMs);

        for (const body of bodies) {
          const fadeMs = body.fallen && body.fallenAtMs !== null ? elapsedMs - body.fallenAtMs : 0;
          if (body.fallen && fadeMs >= FALL_FADE_MS) continue;
          const fade = body.fallen ? Math.max(0, 1 - fadeMs / FALL_FADE_MS) : 1;
          const point = toView(body);
          drawStone(ctx, point.x, point.y, body.owner, fade, 1 - (1 - fade) * 0.4);
        }

        const fallingDone = bodies.every(
          (body) => !body.fallen || (body.fallenAtMs ?? 0) + FALL_FADE_MS <= elapsedMs,
        );
        if (allSettled(bodies) && fallingDone && endedSeqRef.current !== current.seq) {
          endedSeqRef.current = current.seq;
          onReplayEndRef.current?.(current.seq);
        }
        return;
      }

      // 정지 화면
      for (const stone of stonesRef.current) {
        const point = toView(stone);
        drawStone(ctx, point.x, point.y, stone.owner, 1, 1);
      }

      const currentAim = aimRef.current;
      if (!currentAim) return;

      const dx = currentAim.from.x - currentAim.to.x;
      const dy = currentAim.from.y - currentAim.to.y;
      const drag = Math.hypot(dx, dy);
      if (drag < CANCEL_DRAG) return;

      const power = Math.min(drag, MAX_DRAG) / MAX_DRAG;
      const speed = MAX_SHOT_SPEED * power;
      const shot: Shot = {
        stoneId: currentAim.stoneId,
        vx: (dx / drag) * speed,
        vy: (dy / drag) * speed,
      };

      drawAim(ctx, stonesRef.current, currentAim, shot, power, toView);
    }

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function pointerToLogical(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * BOARD_SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * BOARD_SIZE;
    // 화면 좌표를 원본(흑이 아래) 좌표로 되돌립니다. 뒤집기는 이 함수와
    // 그리기의 toView 두 곳에서만 일어나고, 물리와 DB는 언제나 원본입니다.
    return viewAs === 'white' ? { x: BOARD_SIZE - x, y: BOARD_SIZE - y } : { x, y };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!canShoot || !myColor) return;
    const point = pointerToLogical(event);
    // 집기 쉽도록 반지름보다 조금 넉넉하게 잡습니다.
    const picked = stones.find(
      (stone) =>
        stone.owner === myColor &&
        Math.hypot(stone.x - point.x, stone.y - point.y) <= STONE_RADIUS * 1.4,
    );
    if (!picked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setAim({ stoneId: picked.id, from: { x: picked.x, y: picked.y }, to: point });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!aim) return;
    setAim({ ...aim, to: pointerToLogical(event) });
  }

  function handlePointerUp() {
    if (!aim) return;
    // 끈 반대 방향으로 날아갑니다(새총).
    const dx = aim.from.x - aim.to.x;
    const dy = aim.from.y - aim.to.y;
    const drag = Math.hypot(dx, dy);
    setAim(null);
    if (drag < CANCEL_DRAG) return; // 돌 위로 되돌리면 취소
    const power = Math.min(drag, MAX_DRAG) / MAX_DRAG;
    const speed = MAX_SHOT_SPEED * power;
    onShoot({ stoneId: aim.stoneId, vx: (dx / drag) * speed, vy: (dy / drag) * speed });
  }

  return (
    <canvas
      className="alkkagi-board"
      height={BOARD_SIZE}
      onPointerCancel={() => setAim(null)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={canvasRef}
      width={BOARD_SIZE}
    />
  );
}

function drawBoard(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, BOARD_SIZE, BOARD_SIZE);
  gradient.addColorStop(0, '#e0bd85');
  gradient.addColorStop(0.5, '#d9b072');
  gradient.addColorStop(1, '#cfa261');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // 바둑판 격자를 옅게 깔아 "바둑판 위"라는 느낌만 남깁니다.
  ctx.strokeStyle = 'rgba(90, 60, 25, 0.22)';
  ctx.lineWidth = 1;
  const cells = 8;
  const gap = BOARD_SIZE / cells;
  ctx.beginPath();
  for (let i = 1; i < cells; i += 1) {
    ctx.moveTo(gap * i, 0);
    ctx.lineTo(gap * i, BOARD_SIZE);
    ctx.moveTo(0, gap * i);
    ctx.lineTo(BOARD_SIZE, gap * i);
  }
  ctx.stroke();

  // 판 가장자리. 여기를 넘어가면 떨어집니다(중심 기준).
  ctx.strokeStyle = 'rgba(90, 60, 25, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, BOARD_SIZE - 3, BOARD_SIZE - 3);
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  owner: Owner,
  alpha: number,
  scale: number,
) {
  const radius = STONE_RADIUS * scale;
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.arc(x, y + 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fill();

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.15,
    x,
    y,
    radius,
  );
  if (owner === 'black') {
    gradient.addColorStop(0, '#5a5a5a');
    gradient.addColorStop(1, '#111111');
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#ddd7c9');
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  stones: Stone[],
  aim: Aim,
  shot: Shot,
  power: number,
  toView: (p: { x: number; y: number }) => { x: number; y: number },
) {
  const origin = toView(aim.from);

  // 예측 경로는 첫 충돌 지점까지만 그립니다. 끝까지 보여주면 정답을 읽고
  // 클릭하는 게임이 되어버립니다.
  const path = previewPath(stones, shot);
  if (path.length >= 2) {
    ctx.save();
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const first = toView(path[0]);
    ctx.moveTo(first.x, first.y);
    for (const point of path.slice(1)) {
      const view = toView(point);
      ctx.lineTo(view.x, view.y);
    }
    ctx.stroke();
    ctx.restore();

    // 경로 끝에 화살촉
    const last = toView(path[path.length - 1]);
    const prev = toView(path[Math.max(0, path.length - 2)]);
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.translate(last.x, last.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 7);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 끌고 있는 쪽으로 뻗는 고무줄
  const dragPoint = toView(aim.to);
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 20, 10, 0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(dragPoint.x, dragPoint.y);
  ctx.stroke();
  ctx.restore();

  // 파워 게이지. 돌 바로 아래에 붙여 눈이 판을 떠나지 않게 합니다.
  const width = 72;
  const height = 8;
  const left = origin.x - width / 2;
  const top = origin.y + STONE_RADIUS + 10;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = power >= 0.98 ? '#ff6b3d' : '#ffd166';
  ctx.fillRect(left, top, width * power, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}
