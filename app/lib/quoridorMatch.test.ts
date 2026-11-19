import test from 'node:test';
import assert from 'node:assert/strict';
import { START, WALLS_PER_PLAYER, checkWall, formatMove, initialBoard, isGoal, isStepBlocked, parseNotation, type BoardState, type Wall } from './quoridorMatch.ts';

const withWalls = (walls: Wall[], mode: 2 | 4 = 2): BoardState => ({ ...initialBoard(mode), walls });

test('표기 파싱', () => {
  assert.deepEqual(parseNotation('h8h'), { kind: 'wall', wall: { r: 7, c: 7, o: 'h' } });
  assert.deepEqual(parseNotation('h8'), { kind: 'pawn', to: { r: 7, c: 7 } });
  assert.deepEqual(parseNotation('i9v'), { kind: 'wall', wall: { r: 8, c: 8, o: 'v' } });
  assert.deepEqual(parseNotation('e3h'), { kind: 'wall', wall: { r: 2, c: 4, o: 'h' } });
  for (const bad of ['', 'j1', 'e0', 'e10', 'E3h', 'e3x', ' e3h', 'e3hh']) assert.equal(parseNotation(bad), null, bad);
  assert.equal(formatMove(parseNotation('e3h')!), 'e3h');
  assert.equal(formatMove(parseNotation('a1')!), 'a1');
});

test('초기 보드와 목표 변', () => {
  assert.deepEqual(initialBoard(2).pawns, [{ r: 0, c: 4 }, { r: 8, c: 4 }]);
  assert.deepEqual(initialBoard(4).wallsLeft, [5, 5, 5, 5]);
  assert.deepEqual(initialBoard(2).wallsLeft, [10, 10]);
  assert.deepEqual(START[4][1], { r: 4, c: 0 });
  assert.equal(WALLS_PER_PLAYER[2], 10);
  assert.equal(isGoal(2, 0, { r: 8, c: 0 }), true);
  assert.equal(isGoal(2, 1, { r: 0, c: 8 }), true);
  assert.equal(isGoal(4, 1, { r: 3, c: 8 }), true);
  assert.equal(isGoal(4, 3, { r: 3, c: 0 }), true);
  assert.equal(isGoal(4, 3, { r: 3, c: 8 }), false);
});

test('벽이 막는 칸 쌍', () => {
  const h: Wall = { r: 2, c: 4, o: 'h' }; // 3행↔4행, e·f열
  assert.equal(isStepBlocked([h], { r: 2, c: 4 }, { r: 3, c: 4 }), true);
  assert.equal(isStepBlocked([h], { r: 3, c: 5 }, { r: 2, c: 5 }), true);
  assert.equal(isStepBlocked([h], { r: 2, c: 6 }, { r: 3, c: 6 }), false);
  const v: Wall = { r: 2, c: 4, o: 'v' }; // e열↔f열, 3·4행
  assert.equal(isStepBlocked([v], { r: 3, c: 4 }, { r: 3, c: 5 }), true);
  assert.equal(isStepBlocked([v], { r: 4, c: 4 }, { r: 4, c: 5 }), false);
  assert.equal(isStepBlocked([v], { r: 2, c: 5 }, { r: 2, c: 4 }), true); // 순서가 뒤집혀도 같음
});

test('벽 겹침: 같은 방향 |Δ|=0,1 거부, 2 허용', () => {
  const b = withWalls([{ r: 2, c: 4, o: 'h' }]);
  for (const c of [3, 4, 5]) assert.deepEqual(checkWall(b, 0, { r: 2, c, o: 'h' }), { ok: false, reason: 'overlap' });
  for (const c of [2, 6]) assert.deepEqual(checkWall(b, 0, { r: 2, c, o: 'h' }), { ok: true });
  const bv = withWalls([{ r: 2, c: 4, o: 'v' }]);
  assert.deepEqual(checkWall(bv, 0, { r: 3, c: 4, o: 'v' }), { ok: false, reason: 'overlap' });
  assert.deepEqual(checkWall(bv, 0, { r: 4, c: 4, o: 'v' }), { ok: true });
});

test('십자 교차는 거부, T자는 허용', () => {
  const b = withWalls([{ r: 2, c: 4, o: 'h' }]);
  assert.deepEqual(checkWall(b, 0, { r: 2, c: 4, o: 'v' }), { ok: false, reason: 'cross' });
  assert.deepEqual(checkWall(b, 0, { r: 2, c: 3, o: 'v' }), { ok: true });
  assert.deepEqual(checkWall(withWalls([{ r: 2, c: 4, o: 'v' }]), 0, { r: 2, c: 4, o: 'h' }), { ok: false, reason: 'cross' });
});

test('범위 밖·남은 벽 없음', () => {
  assert.deepEqual(checkWall(initialBoard(2), 0, { r: 8, c: 8, o: 'v' }), { ok: false, reason: 'out_of_range' });
  assert.deepEqual(checkWall({ ...initialBoard(2), wallsLeft: [0, 10] }, 0, { r: 2, c: 4, o: 'h' }), { ok: false, reason: 'no_walls' });
});
