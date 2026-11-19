import type { Cell, Mode, Wall, WallCheck } from './quoridorMatch';

// 쿼리도 보드 화면용 순수 헬퍼. 내 출발 변이 항상 아래에 오도록 보드를 회전해서 그리고,
// 서버로 보내는 표기는 항상 절대 좌표입니다. 변환은 이 파일에서만 합니다.
//
// 회전은 "절대 좌표 → 화면 좌표" 방향입니다(행 r은 화면 아래→위, 열 c는 왼→오).
//   0   (r, c)
//   90  (c, 8-r)     4인 1번(a5, 왼쪽 변)이 아래로
//   180 (8-r, 8-c)   위쪽 변이 아래로
//   270 (8-c, r)     4인 3번(i5, 오른쪽 변)이 아래로
// 벽은 교차점(칸 사이 점) 기준이라 8 대신 7을 쓰고, 90·270에서는 가로·세로가 바뀝니다.

export type Rotation = 0 | 90 | 180 | 270;
export type Side = 'up' | 'down' | 'left' | 'right';

const SEAT_ROTATION: Record<Mode, Rotation[]> = { 2: [0, 180], 4: [0, 90, 180, 270] };

/** 내 출발 변이 아래로 오게 하는 회전. 관전자(mySeat=null)는 0. */
export function rotationFor(mode: Mode, mySeat: number | null): Rotation {
  if (mySeat === null) return 0;
  return SEAT_ROTATION[mode][mySeat] ?? 0;
}

function rotate(r: number, c: number, max: number, rot: Rotation): { r: number; c: number } {
  switch (rot) {
    case 90: return { r: c, c: max - r };
    case 180: return { r: max - r, c: max - c };
    case 270: return { r: max - c, c: r };
    default: return { r, c };
  }
}

const inverse = (rot: Rotation): Rotation => ((360 - rot) % 360) as Rotation;
const swaps = (rot: Rotation) => rot === 90 || rot === 270;

export function cellToView(cell: Cell, rot: Rotation): Cell {
  return rotate(cell.r, cell.c, 8, rot);
}

export function cellFromView(cell: Cell, rot: Rotation): Cell {
  return rotate(cell.r, cell.c, 8, inverse(rot));
}

export function wallToView(wall: Wall, rot: Rotation): Wall {
  const { r, c } = rotate(wall.r, wall.c, 7, rot);
  return { r, c, o: swaps(rot) ? (wall.o === 'h' ? 'v' : 'h') : wall.o };
}

export function wallFromView(wall: Wall, rot: Rotation): Wall {
  return wallToView(wall, inverse(rot));
}

/** 칸 5단위 + 홈 1단위를 번갈아 놓은 53단위 보드. 교차점 i의 중심은 6i + 5.5. */
const UNITS = 53;
const clamp = (n: number) => Math.min(7, Math.max(0, n));

/** 보드(정사각형, 한 변 boardPx) 위 탭 좌표(왼쪽 위 원점) → 가장 가까운 교차점(화면 좌표). */
export function nearestIntersection(x: number, y: number, boardPx: number): { r: number; c: number } {
  const toIndex = (px: number) => clamp(Math.round(((px / boardPx) * UNITS - 5.5) / 6));
  return { r: 7 - toIndex(y), c: toIndex(x) };
}

export function wallReasonLabel(check: WallCheck, nameOfSeat: (seat: number) => string): string | null {
  if (check.ok) return null;
  switch (check.reason) {
    case 'no_walls': return '남은 벽 없음';
    case 'out_of_range': return '보드 밖';
    case 'overlap': return '겹침';
    case 'cross': return '교차';
    case 'blocks_path': return `${check.blockedSeats.map(nameOfSeat).join('·')}의 길을 막음`;
  }
}

const GOAL_SIDE: Record<Mode, Side[]> = { 2: ['up', 'down'], 4: ['up', 'right', 'down', 'left'] };
const SIDE_VECTOR: Record<Side, { r: number; c: number }> = { up: { r: 1, c: 0 }, down: { r: -1, c: 0 }, right: { r: 0, c: 1 }, left: { r: 0, c: -1 } };

/** seat의 목표 변이 화면에서 어느 쪽인지(칩의 화살표용). */
export function goalSideToView(mode: Mode, seat: number, rot: Rotation): Side {
  const v = SIDE_VECTOR[GOAL_SIDE[mode][seat] ?? 'up'];
  const turned = rotate(v.r, v.c, 0, rot); // 방향 벡터는 평행이동 없이 돌립니다
  return (Object.keys(SIDE_VECTOR) as Side[]).find((s) => SIDE_VECTOR[s].r === turned.r && SIDE_VECTOR[s].c === turned.c) ?? 'up';
}
