import test from 'node:test';
import assert from 'node:assert/strict';
import { START, WALLS_PER_PLAYER, applyMove, checkWall, formatMove, hasAnyLegalMove, hasPath, initialBoard, isGoal, isStepBlocked, legalPawnMoves, parseNotation, type BoardState, type Wall } from './quoridorMatch.ts';

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

const key = (cells: { r: number; c: number }[]) => cells.map((x) => `${x.r},${x.c}`).sort();
const at = (mode: 2 | 4, pawns: { r: number; c: number }[], walls: Wall[] = []): BoardState => ({
  mode, pawns, walls, wallsLeft: pawns.map(() => 5), active: pawns.map(() => true),
});

test('빈 칸 상하좌우, 보드 끝, 벽', () => {
  assert.deepEqual(key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 8, c: 0 }]), 0)), key([{ r: 5, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 5 }]));
  assert.deepEqual(key(legalPawnMoves(at(2, [{ r: 0, c: 0 }, { r: 8, c: 8 }]), 0)), key([{ r: 1, c: 0 }, { r: 0, c: 1 }]));
  const blocked = legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 8, c: 0 }], [{ r: 4, c: 4, o: 'h' }]), 0);
  assert.equal(key(blocked).includes('5,4'), false);
});

test('직선 점프, 대각선 없음', () => {
  const m = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 5, c: 4 }]), 0));
  assert.ok(m.includes('6,4'));
  for (const no of ['5,4', '5,3', '5,5']) assert.equal(m.includes(no), false, no);
});

test('뒤가 벽이면 좌우로 비껴가기', () => {
  const m = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 5, c: 4 }], [{ r: 5, c: 4, o: 'h' }]), 0));
  assert.ok(m.includes('5,3') && m.includes('5,5'));
  assert.equal(m.includes('6,4'), false);
});

test('뒤가 다른 말이면 비껴가기, 두 말 연속 점프 불가', () => {
  const m = key(legalPawnMoves(at(4, [{ r: 4, c: 4 }, { r: 5, c: 4 }, { r: 6, c: 4 }, { r: 0, c: 0 }]), 0));
  assert.ok(m.includes('5,3') && m.includes('5,5'));
  assert.equal(m.includes('6,4') || m.includes('7,4'), false);
});

test('뒤가 보드 끝이면 비껴가기', () => {
  const m = key(legalPawnMoves(at(2, [{ r: 7, c: 4 }, { r: 8, c: 4 }]), 0));
  assert.ok(m.includes('8,3') && m.includes('8,5'));
});

test('뒤가 열렸으면 비껴가기 불가', () => {
  const m = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 5, c: 4 }]), 0));
  assert.equal(m.includes('5,3') || m.includes('5,5'), false);
});

test('비껴갈 칸 쪽에 벽이 있거나 말이 있으면 그쪽은 불가', () => {
  const walled = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 5, c: 4 }], [{ r: 5, c: 4, o: 'h' }, { r: 4, c: 4, o: 'v' }]), 0));
  assert.ok(walled.includes('5,3'));
  assert.equal(walled.includes('5,5'), false);
  const occupied = key(legalPawnMoves(at(4, [{ r: 4, c: 4 }, { r: 5, c: 4 }, { r: 5, c: 3 }, { r: 0, c: 0 }], [{ r: 5, c: 3, o: 'h' }]), 0));
  assert.ok(occupied.includes('5,5'));
  assert.equal(occupied.includes('5,3') || occupied.includes('5,2'), false);
});

test('나와 옆 말 사이가 벽이면 점프도 비껴가기도 없음', () => {
  const m = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 5, c: 4 }], [{ r: 4, c: 3, o: 'h' }]), 0));
  for (const no of ['5,4', '6,4', '5,3', '5,5']) assert.equal(m.includes(no), false, no);
});

test('나간 사람의 말도 장애물(넘을 수는 있음)', () => {
  const b = { ...at(4, [{ r: 4, c: 4 }, { r: 5, c: 4 }, { r: 8, c: 4 }, { r: 4, c: 8 }]), active: [true, false, true, true] };
  const m = key(legalPawnMoves(b, 0));
  assert.equal(m.includes('5,4'), false);
  assert.ok(m.includes('6,4'));
});

test('좌우·아래 방향 점프와 비껴가기', () => {
  // 오른쪽: 뒤 (4,6)이 벽 v{4,5}로 막혀 위·아래로 비껴감
  const right = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 4, c: 5 }], [{ r: 4, c: 5, o: 'v' }]), 0));
  assert.ok(right.includes('3,5') && right.includes('5,5'));
  assert.equal(right.includes('4,6'), false);
  // 아래: 뒤가 열려 있으면 직선 점프만
  const down = key(legalPawnMoves(at(2, [{ r: 4, c: 4 }, { r: 3, c: 4 }]), 0));
  assert.ok(down.includes('2,4'));
  assert.equal(down.includes('3,3') || down.includes('3,5'), false);
});

// 0행↔1행 사이 a~h열을 막아 i열 하나만 열어 둔 상태
const fence: Wall[] = [0, 2, 4, 6].map((c) => ({ r: 0, c, o: 'h' as const }));
const sealer: Wall = { r: 0, c: 7, o: 'v' }; // h1↔i1, h2↔i2 를 막아 0번을 가둠

test('길 막힘: 2인, 자기 길만 막는 벽도 거부', () => {
  const b = { ...initialBoard(2), walls: fence };
  assert.equal(hasPath(b, 0), true);
  assert.deepEqual(checkWall(b, 0, sealer), { ok: false, reason: 'blocks_path', blockedSeats: [0] });
  assert.deepEqual(checkWall(b, 1, sealer), { ok: false, reason: 'blocks_path', blockedSeats: [0] });
});

test('길 막힘: 4인', () => {
  const b = { ...initialBoard(4), walls: fence };
  assert.deepEqual(checkWall(b, 2, sealer), { ok: false, reason: 'blocks_path', blockedSeats: [0] });
});

test('길 막힘: 열이 목표인 1·3번, 여러 자리가 함께 막히면 오름차순', () => {
  // c=3|4 사이를 2~9행에서 막고, 1행의 틈 뒤 e1·f1을 위와 오른쪽에서 막는다
  const colFence: Wall[] = [1, 3, 5, 7].map((r) => ({ r, c: 3, o: 'v' as const }));
  const b = { ...initialBoard(4), walls: [...colFence, { r: 0, c: 4, o: 'h' as const }] };
  assert.deepEqual(checkWall(b, 0, { r: 0, c: 5, o: 'v' }), { ok: false, reason: 'blocks_path', blockedSeats: [1, 3] });
});

test('다른 말이 유일한 길 위에 있어도 벽은 허용', () => {
  const b = { ...initialBoard(2), walls: fence, pawns: [{ r: 0, c: 4 }, { r: 1, c: 8 }] };
  assert.deepEqual(checkWall(b, 1, { r: 5, c: 0, o: 'h' }), { ok: true });
});

test('나간 플레이어는 길 검사에서 제외', () => {
  const b = { ...initialBoard(4), walls: fence, active: [false, true, true, true] };
  assert.deepEqual(checkWall(b, 1, sealer), { ok: true });
});

test('applyMove: 벽은 개수 차감, 말은 이동, 목표 도착은 won', () => {
  const w = applyMove(initialBoard(2), 0, { kind: 'wall', wall: { r: 2, c: 4, o: 'h' } });
  assert.ok(w.ok && w.board.wallsLeft[0] === 9 && w.board.walls.length === 1 && !w.won);
  const near = { ...initialBoard(2), pawns: [{ r: 7, c: 4 }, { r: 8, c: 0 }] };
  const win = applyMove(near, 0, { kind: 'pawn', to: { r: 8, c: 4 } });
  assert.ok(win.ok && win.won);
  assert.deepEqual(applyMove(initialBoard(2), 0, { kind: 'pawn', to: { r: 2, c: 4 } }), { ok: false, reason: 'illegal_pawn' });
  assert.deepEqual(initialBoard(2).walls, []); // 입력 불변
  const side = { ...initialBoard(4), pawns: [{ r: 0, c: 4 }, { r: 4, c: 7 }, { r: 8, c: 4 }, { r: 0, c: 0 }] };
  const colWin = applyMove(side, 1, { kind: 'pawn', to: { r: 4, c: 8 } });
  assert.ok(colWin.ok && colWin.won);
  const jump = { ...initialBoard(2), pawns: [{ r: 6, c: 4 }, { r: 7, c: 4 }] };
  const jumpWin = applyMove(jump, 0, { kind: 'pawn', to: { r: 8, c: 4 } });
  assert.ok(jumpWin.ok && jumpWin.won);
});

// 0번(a1): 오른쪽은 벽, 위는 1번 말, 그 뒤는 2번 말, 비껴갈 칸 b2는 같은 벽에 막힘.
// 말은 무시하는 길 검사로는 a열을 따라 길이 열려 있다.
const stuck: BoardState = {
  mode: 4,
  pawns: [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 8, c: 8 }],
  walls: [{ r: 0, c: 0, o: 'v' }],
  wallsLeft: [0, 5, 5, 5],
  active: [true, true, true, true],
};

test('hasAnyLegalMove: 말 이동도 벽도 없으면 false, 벽이 남았으면 true', () => {
  assert.deepEqual(legalPawnMoves(stuck, 0), []);
  assert.equal(hasAnyLegalMove(stuck, 0), false);
  assert.equal(hasAnyLegalMove({ ...stuck, wallsLeft: [5, 5, 5, 5] }, 0), true);
  assert.equal(hasAnyLegalMove({ ...initialBoard(2), wallsLeft: [0, 10] }, 0), true);
});
