import test from 'node:test';
import assert from 'node:assert/strict';
import { START, isStepBlocked } from './quoridorMatch.ts';
import {
  cellFromView,
  cellToView,
  goalSideToView,
  nearestIntersection,
  rotationFor,
  wallFromView,
  wallReasonLabel,
  wallToView,
} from './quoridorView.ts';

const ROTS = [0, 90, 180, 270] as const;
const cells = Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 }));
const walls = Array.from({ length: 128 }, (_, i) => ({ r: Math.floor((i % 64) / 8), c: i % 8, o: (i < 64 ? 'h' : 'v') as 'h' | 'v' }));

test('각 자리의 출발 칸이 화면 아래 가운데(e1)로 온다', () => {
  for (const mode of [2, 4] as const) START[mode].forEach((start, seat) => {
    assert.deepEqual(cellToView(start, rotationFor(mode, seat)), { r: 0, c: 4 }, `${mode}-${seat}`);
  });
  assert.equal(rotationFor(4, null), 0);
});

test('칸·벽 변환은 왕복하면 원래대로', () => {
  for (const rot of ROTS) {
    for (const cell of cells) assert.deepEqual(cellFromView(cellToView(cell, rot), rot), cell);
    for (const w of walls) assert.deepEqual(wallFromView(wallToView(w, rot), rot), w);
  }
});

test('회전해도 벽이 막는 칸 쌍은 같다', () => {
  const steps = cells.flatMap((a) => [{ r: a.r + 1, c: a.c }, { r: a.r, c: a.c + 1 }].filter((b) => b.r < 9 && b.c < 9).map((b) => [a, b] as const));
  for (const rot of ROTS) for (const w of walls) for (const [a, b] of steps) {
    assert.equal(isStepBlocked([wallToView(w, rot)], cellToView(a, rot), cellToView(b, rot)), isStepBlocked([w], a, b));
  }
});

test('탭 위치 → 가장 가까운 교차점', () => {
  assert.deepEqual(nearestIntersection(60, 470, 530), { r: 0, c: 0 });
  assert.deepEqual(nearestIntersection(270, 250, 530), { r: 4, c: 4 });
  assert.deepEqual(nearestIntersection(0, 0, 530), { r: 7, c: 0 });
});

test('놓을 수 없는 이유 한 줄', () => {
  const name = (s: number) => ['민지', '철수'][s];
  assert.equal(wallReasonLabel({ ok: false, reason: 'overlap' }, name), '겹침');
  assert.equal(wallReasonLabel({ ok: false, reason: 'blocks_path', blockedSeats: [0, 1] }, name), '민지·철수의 길을 막음');
  assert.equal(wallReasonLabel({ ok: true }, name), null);
});

test('목표 방향 화살표: 내 목표는 항상 위, 관전자 기준 2인 1번은 아래', () => {
  for (const mode of [2, 4] as const) for (let seat = 0; seat < mode; seat += 1) {
    assert.equal(goalSideToView(mode, seat, rotationFor(mode, seat)), 'up');
  }
  assert.equal(goalSideToView(2, 1, 0), 'down');
  assert.equal(goalSideToView(4, 1, 0), 'right');
  assert.equal(goalSideToView(4, 3, 0), 'left');
});
