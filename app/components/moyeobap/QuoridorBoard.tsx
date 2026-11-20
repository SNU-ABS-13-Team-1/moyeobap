'use client';

import { useRef, type PointerEvent } from 'react';
import { isGoal, type Cell, type Move, type Wall } from '../../lib/quoridorMatch';
import { isRacing, playerLabel, type QuoridorRoom } from '../../lib/quoridorRoom';
import { cellFromView, goalSideToView, nearestIntersection, wallToView, type Rotation, type Side } from '../../lib/quoridorView';

export const SEAT_SHAPES = ['●', '▲', '■', '◆'] as const;

export type WallPointerKind = 'hover' | 'down' | 'drag' | 'leave';

type Props = {
  room: QuoridorRoom;
  rotation: Rotation;
  inputMode: 'move' | 'wall';
  /** 지금 갈 수 있는 칸(절대 좌표). 내 차례가 아니거나 요청 중이면 빈 배열. */
  moveTargets: Cell[];
  onMove: (cell: Cell) => void;
  /** 화면 좌표의 미리보기 벽·호버 벽. */
  preview: Wall | null;
  previewInvalid: boolean;
  hover: Wall | null;
  onWallPointer: (kind: WallPointerKind, point: { r: number; c: number }, pointerType: string) => void;
  /** 강조할 상대의 마지막 수(절대 좌표). */
  lastMove: { seat: number; move: Move } | null;
  /** 내 목표 줄을 칠할 자리(아직 경기 중인 내 자리). 관전자·도착 후에는 null. */
  goalSeat: number | null;
};

const sameCell = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;

// 그리드는 칸(5) + 홈(1)을 번갈아 둔 17x17 트랙입니다. 화면 좌표(행은 아래→위)로 배치합니다.
const cellArea = (v: Cell) => ({ gridRow: 17 - 2 * v.r, gridColumn: 2 * v.c + 1 });
const wallArea = (w: Wall) =>
  w.o === 'h'
    ? { gridRow: 16 - 2 * w.r, gridColumn: `${2 * w.c + 1} / span 3` }
    : { gridRow: `${15 - 2 * w.r} / span 3`, gridColumn: 2 * w.c + 2 };

// 쿼리도 보드. 그리기와 입력 해석만 하고, 미리보기 상태·확정은 QuoridorRoom이 갖습니다.
export function QuoridorBoard({ room, rotation, inputMode, moveTargets, onMove, preview, previewInvalid, hover, onWallPointer, lastMove, goalSeat }: Props) {
  const lastCell = lastMove?.move.kind === 'pawn' ? lastMove.move.to : null;
  const lastWall = lastMove?.move.kind === 'wall' ? lastMove.move.wall : null;
  const lastClass = lastMove ? ` quoridor-room__last--seat${lastMove.seat}` : '';
  const gridRef = useRef<HTMLDivElement>(null);

  // 목표 변 색 띠: 아직 경기 중인 사람마다 그 사람 목표 변 쪽에 색을 칠합니다.
  const bands: { side: Side; seat: number }[] = room.status === 'waiting'
    ? []
    : room.players.flatMap((p, seat) => (isRacing(p) ? [{ side: goalSideToView(room.mode, seat, rotation), seat }] : []));

  function pointFrom(event: PointerEvent<HTMLDivElement>) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return nearestIntersection(event.clientX - rect.left, event.clientY - rect.top, rect.width);
  }

  const wallHandlers = inputMode === 'wall'
    ? {
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          const point = pointFrom(event);
          if (!point) return;
          if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId);
          onWallPointer('down', point, event.pointerType);
        },
        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
          const point = pointFrom(event);
          if (!point) return;
          // 마우스는 누르지 않아도 move가 계속 와서 호버만 보여줍니다. 터치·펜은 누른 동안만 따라옵니다.
          if (event.pointerType === 'mouse') onWallPointer(event.buttons ? 'drag' : 'hover', point, event.pointerType);
          else if (event.buttons) onWallPointer('drag', point, event.pointerType);
        },
        onPointerLeave: (event: PointerEvent<HTMLDivElement>) => onWallPointer('leave', { r: 0, c: 0 }, event.pointerType),
      }
    : {};

  const cells = [];
  for (let vr = 8; vr >= 0; vr -= 1) {
    for (let vc = 0; vc < 9; vc += 1) {
      const view = { r: vr, c: vc };
      const abs = cellFromView(view, rotation);
      const seat = room.status === 'waiting' ? -1 : room.pawns.findIndex((p) => sameCell(p, abs));
      const player = seat >= 0 ? room.players[seat] : null;
      const target = moveTargets.some((t) => sameCell(t, abs));
      const last = lastCell && sameCell(lastCell, abs) ? ` quoridor-room__cell--last${lastClass}` : '';
      const goal = goalSeat !== null && room.status === 'playing' && isGoal(room.mode, goalSeat, abs)
        ? ` quoridor-room__cell--goal quoridor-room__cell--goal-${vr === 8 ? 'up' : vr === 0 ? 'down' : vc === 0 ? 'left' : 'right'} quoridor-room__goal--seat${goalSeat}`
        : '';
      const content = (
        <>
          {player && (
            <span
              aria-label={`${playerLabel(room, seat)}의 말`}
              className={`quoridor-room__pawn quoridor-room__pawn--seat${seat} ${player.left || player.resigned ? 'quoridor-room__pawn--left' : ''}`}
            >
              {SEAT_SHAPES[seat]}
            </span>
          )}
          {target && <span aria-hidden="true" className="quoridor-room__dot" />}
        </>
      );
      cells.push(
        target && inputMode === 'move' ? (
          <button
            aria-label={`${'abcdefghi'[abs.c]}${abs.r + 1}로 이동`}
            className={`quoridor-room__cell quoridor-room__cell--target${goal}${last}`}
            key={`${vr}-${vc}`}
            onClick={() => onMove(abs)}
            style={cellArea(view)}
            type="button"
          >
            {content}
          </button>
        ) : (
          <div className={`quoridor-room__cell${goal}${last}`} key={`${vr}-${vc}`} style={cellArea(view)}>
            {content}
          </div>
        ),
      );
    }
  }

  return (
    <div className="quoridor-room__board-wrap">
      {bands.map(({ side, seat }) => (
        <span aria-hidden="true" className={`quoridor-room__band quoridor-room__band--${side} quoridor-room__band--seat${seat}`} key={`${side}-${seat}`} />
      ))}
      <div
        className={`quoridor-room__board ${inputMode === 'wall' ? 'quoridor-room__board--wall' : ''}`}
        ref={gridRef}
        {...wallHandlers}
      >
        {cells}
        {room.walls.map((w) => {
          const v = wallToView(w, rotation);
          const isLast = lastWall && lastWall.r === w.r && lastWall.c === w.c && lastWall.o === w.o;
          return (
            <span
              aria-hidden="true"
              className={`quoridor-room__wall quoridor-room__wall--${v.o}${isLast ? ` quoridor-room__wall--last${lastClass}` : ''}`}
              key={`${w.r}-${w.c}-${w.o}`}
              style={wallArea(v)}
            />
          );
        })}
        {hover && !(preview && hover.r === preview.r && hover.c === preview.c) && (
          <span aria-hidden="true" className={`quoridor-room__wall quoridor-room__wall--${hover.o} quoridor-room__wall--hover`} style={wallArea(hover)} />
        )}
        {preview && (
          <span
            aria-hidden="true"
            className={`quoridor-room__wall quoridor-room__wall--${preview.o} quoridor-room__wall--preview ${previewInvalid ? 'quoridor-room__wall--invalid' : ''}`}
            style={wallArea(preview)}
          />
        )}
      </div>
    </div>
  );
}
