// 알까기의 판 규격과 물리입니다. DB도 렌더링도 모르는 순수 모듈이라 서버
// (결과 확정)와 클라이언트(굴러가는 장면)가 같은 코드를 그대로 씁니다.
//
// 이 모듈이 결정적이어야 설계 전체가 성립합니다. 서버는 샷 하나를 받아
// 최종 배치를 확정하고, 두 클라이언트는 "발사 전 배치 + 샷"만으로 같은
// 장면을 각자 그립니다. 그래서 Math.random도 Date.now도 쓰지 않고, 돌을
// 처리하는 순서도 id 정렬로 고정합니다.

export const BOARD_SIZE = 640;
export const STONE_RADIUS = 26;
export const STONES_PER_SIDE = 5;

/** 시작 배치: 위아래 변에서 START_MARGIN 들어온 줄에 START_GAP 간격으로. */
const START_MARGIN = 60;
const START_GAP = 128;
const START_X0 = 64;

/** 고정 시뮬 간격. 최대 속도에서 한 스텝 이동이 5단위라 반지름(26)보다
 *  훨씬 작습니다 — 빠른 돌이 다른 돌을 뚫고 지나가지 않습니다. */
export const DT = 1 / 240;
/** 등감속(단위/s^2). 바둑돌은 미끄러지다 서는 마찰이라 지수감쇠보다 이쪽이 맞습니다. */
export const FRICTION = 1100;
/** 최대 파워로 655단위를 굴러가 판(640)을 겨우 가로지릅니다. */
export const MAX_SHOT_SPEED = 1200;
/** 이보다 약한 샷은 손이 미끄러진 것으로 보고 거절합니다(턴을 낭비시키지 않음). */
export const MIN_SHOT_SPEED = 60;
export const STOP_SPEED = 8;
export const RESTITUTION = 0.94;
export const MAX_SIM_SECONDS = 8;
const MAX_STEPS = Math.ceil(MAX_SIM_SECONDS / DT);

/** 화면에서 끌 수 있는 최대 거리(논리 단위)와, 이보다 짧으면 발사를 취소하는 임계. */
export const MAX_DRAG = 213;
export const CANCEL_DRAG = 16;

export type Owner = "black" | "white";
export type Stone = { id: string; owner: Owner; x: number; y: number };
export type Shot = { stoneId: string; vx: number; vy: number };
export type Body = Stone & { vx: number; vy: number; fallen: boolean; fallenAtMs: number | null };
export type ShotResult = { stones: Stone[]; removed: string[]; durationMs: number };

function sortStones<T extends { id: string }>(stones: T[]): T[] {
  return [...stones].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function initialStones(): Stone[] {
  const stones: Stone[] = [];
  for (let i = 0; i < STONES_PER_SIDE; i += 1) {
    const x = START_X0 + START_GAP * i;
    stones.push({ id: `w${i}`, owner: "white", x, y: START_MARGIN });
    stones.push({ id: `b${i}`, owner: "black", x, y: BOARD_SIZE - START_MARGIN });
  }
  return sortStones(stones);
}

export function toBodies(stones: Stone[]): Body[] {
  return sortStones(stones).map((stone) => ({
    ...stone,
    vx: 0,
    vy: 0,
    fallen: false,
    fallenAtMs: null,
  }));
}

/** 최대 속도를 넘는 샷을 방향은 그대로 두고 크기만 잘라냅니다. */
export function clampShot(shot: Shot): Shot {
  const speed = Math.hypot(shot.vx, shot.vy);
  if (speed <= MAX_SHOT_SPEED || speed === 0) return shot;
  const k = MAX_SHOT_SPEED / speed;
  return { stoneId: shot.stoneId, vx: shot.vx * k, vy: shot.vy * k };
}

/** 샷의 대상 돌에 속도를 실습니다. 그 돌이 없으면 false. */
export function applyShot(bodies: Body[], shot: Shot): boolean {
  const target = bodies.find((body) => body.id === shot.stoneId && !body.fallen);
  if (!target) return false;
  const clamped = clampShot(shot);
  target.vx = clamped.vx;
  target.vy = clamped.vy;
  return true;
}

/** 한 스텝. stepIndex는 떨어진 시각(fallenAtMs)을 남기는 데만 씁니다. */
function step(bodies: Body[], stepIndex: number): void {
  // 1) 마찰로 감속하고 이동합니다.
  for (const body of bodies) {
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > 0) {
      const next = speed - FRICTION * DT;
      if (next < STOP_SPEED) {
        body.vx = 0;
        body.vy = 0;
      } else {
        const k = next / speed;
        body.vx *= k;
        body.vy *= k;
      }
    }
    body.x += body.vx * DT;
    body.y += body.vy * DT;
  }

  // 2) 판 밖으로 나간 돌을 표시합니다. 중심 기준이라 가장자리에 반쯤 걸친
  //    돌은 살아남습니다. 표시된 순간부터 충돌에서 빠지므로, 떨어지는 돌이
  //    남은 돌을 건드리는 일은 없습니다.
  for (const body of bodies) {
    if (body.fallen) continue;
    if (body.x < 0 || body.x > BOARD_SIZE || body.y < 0 || body.y > BOARD_SIZE) {
      body.fallen = true;
      body.fallenAtMs = stepIndex * DT * 1000;
    }
  }

  // 3) 충돌. 같은 질량 정면 충돌에 반발계수를 적용해 법선 성분만 바꾸고
  //    접선 성분은 그대로 둡니다(비껴 맞으면 얇게 튀는 감각).
  const live = bodies.filter((body) => !body.fallen);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0 || dist >= STONE_RADIUS * 2) continue;

      const nx = dx / dist;
      const ny = dy / dist;

      // 겹침을 절반씩 밀어 풀어줍니다(안 하면 돌이 서로 파고듭니다).
      const overlap = STONE_RADIUS * 2 - dist;
      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;

      const va = a.vx * nx + a.vy * ny;
      const vb = b.vx * nx + b.vy * ny;
      if (vb - va >= 0) continue; // 이미 서로 멀어지는 중

      const e = RESTITUTION;
      const nextA = ((1 - e) * va + (1 + e) * vb) / 2;
      const nextB = ((1 + e) * va + (1 - e) * vb) / 2;
      a.vx += (nextA - va) * nx;
      a.vy += (nextA - va) * ny;
      b.vx += (nextB - vb) * nx;
      b.vy += (nextB - vb) * ny;
    }
  }
}

/** 판에 남은 돌이 모두 멈췄는지. 떨어지는 중인 돌은 따지지 않습니다. */
export function allSettled(bodies: Body[]): boolean {
  return bodies.every((body) => body.fallen || (body.vx === 0 && body.vy === 0));
}

export function aliveStones(bodies: Body[]): Stone[] {
  return sortStones(
    bodies
      .filter((body) => !body.fallen)
      .map((body) => ({ id: body.id, owner: body.owner, x: body.x, y: body.y })),
  );
}

/**
 * 클라이언트 애니메이션용. 지금까지 진행한 스텝 수와 "지금 몇 ms 지점을
 * 그려야 하는지"를 받아 그 지점까지 스텝을 돌리고, 새 스텝 수를 돌려줍니다.
 * 프레임 간격이 들쭉날쭉해도 결과가 흔들리지 않게 고정 스텝으로만 진행합니다.
 */
export function advance(bodies: Body[], stepsDone: number, elapsedMs: number): number {
  const want = Math.min(Math.floor(elapsedMs / (DT * 1000)), MAX_STEPS);
  for (let i = stepsDone; i < want; i += 1) step(bodies, i);
  return Math.max(stepsDone, want);
}

/**
 * 서버가 결과를 확정할 때 쓰는 전체 시뮬레이션입니다. 남은 돌이 모두 멈추면
 * 끝내고, 그 시각을 durationMs로 돌려줍니다(다음 사람의 턴 시계를 이 시각
 * 뒤부터 시작시키는 데 씁니다).
 */
export function simulateShot(stones: Stone[], shot: Shot): ShotResult {
  const bodies = toBodies(stones);
  if (!applyShot(bodies, shot)) {
    return { stones: sortStones(stones), removed: [], durationMs: 0 };
  }

  let steps = 0;
  while (steps < MAX_STEPS && !allSettled(bodies)) {
    step(bodies, steps);
    steps += 1;
  }

  return {
    stones: aliveStones(bodies),
    removed: sortStones(bodies.filter((body) => body.fallen)).map((body) => body.id),
    durationMs: Math.round(steps * DT * 1000),
  };
}

/**
 * 조준 중에 그리는 예측 경로입니다. **첫 충돌 지점까지만** 돌려줍니다 —
 * 끝까지 보여주면 정답을 읽고 클릭하는 게임이 되어버립니다. 맞히려는
 * 의도는 세울 수 있고, 맞은 뒤에 뭐가 어떻게 튀는지는 손끝에 남깁니다.
 */
export function previewPath(stones: Stone[], shot: Shot): { x: number; y: number }[] {
  const bodies = toBodies(stones);
  const shooter = bodies.find((body) => body.id === shot.stoneId);
  if (!shooter) return [];
  const others = bodies.filter((body) => body.id !== shot.stoneId);

  const clamped = clampShot(shot);
  shooter.vx = clamped.vx;
  shooter.vy = clamped.vy;

  const path: { x: number; y: number }[] = [{ x: shooter.x, y: shooter.y }];
  const SAMPLE_EVERY = 6; // 240Hz 시뮬을 40Hz로 솎아 점선으로 그립니다.

  for (let i = 0; i < MAX_STEPS; i += 1) {
    // 다른 돌은 세우고 쏘는 돌만 움직입니다(첫 충돌까지만 필요하므로).
    step([shooter], i);
    if (i % SAMPLE_EVERY === 0) path.push({ x: shooter.x, y: shooter.y });

    if (shooter.fallen) break;
    if (shooter.vx === 0 && shooter.vy === 0) break;

    const hit = others.some(
      (other) => Math.hypot(other.x - shooter.x, other.y - shooter.y) < STONE_RADIUS * 2,
    );
    if (hit) break;
  }

  path.push({ x: shooter.x, y: shooter.y });
  return path;
}
