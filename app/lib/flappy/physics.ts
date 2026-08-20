// 순수 물리 함수입니다. React/캔버스에 의존하지 않아 테스트하기 쉽고,
// FPS와 무관하게 delta time(dt, 초 단위)을 받아 동작합니다.

import { FLAP_VELOCITY, GRAVITY, MAX_FALL_SPEED } from './constants';

export function applyGravity(velocityY: number, dt: number): number {
  return Math.min(velocityY + GRAVITY * dt, MAX_FALL_SPEED);
}

export function flapVelocity(): number {
  return FLAP_VELOCITY;
}

export function updatePosition(y: number, velocityY: number, dt: number): number {
  return y + velocityY * dt;
}

// 상승 중엔 부리를 위로, 하강 중엔 점점 아래로 기울이는 클래식한 회전 연출.
export function getBirdRotation(velocityY: number): number {
  const ratio = Math.max(-1, Math.min(1, velocityY / MAX_FALL_SPEED));
  const minAngle = -0.45; // 위로 최대 -25.8도
  const maxAngle = 1.4; // 아래로 최대 80도
  return ratio < 0 ? ratio * -minAngle : ratio * maxAngle;
}

export function circleRectCollides(
  cx: number,
  cy: number,
  radius: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
): boolean {
  const closestX = Math.max(rectX, Math.min(cx, rectX + rectW));
  const closestY = Math.max(rectY, Math.min(cy, rectY + rectH));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function circleCollides(
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = aRadius + bRadius;
  return dx * dx + dy * dy < r * r;
}
