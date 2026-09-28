'use client';

import { useId, useMemo, useState } from 'react';
import { FORBIDDEN_MOVE_MESSAGES, isForbiddenMove } from '../../lib/omokForbidden';
import type { Stone } from '../../lib/omokRoomState';

// 판 좌표계(viewBox 단위)입니다. 실제 화면 크기는 CSS가 정하고 SVG가 비율대로
// 늘려 그리므로, 레티나에서도 흐려지지 않고 칸 폭에 맞춰 커집니다.
const CELL = 26;
const PADDING = 24;
const STONE_RADIUS = CELL / 2 - 1.5;

type Color = Exclude<Stone, null>;
type Point = { row: number; col: number };

// 15줄 판은 네 귀의 화점(3·11)과 천원(7), 19줄 판은 3·9·15 교차점입니다.
function starPoints(size: number): Point[] {
  if (size === 15) {
    return [
      { row: 3, col: 3 }, { row: 3, col: 11 }, { row: 7, col: 7 },
      { row: 11, col: 3 }, { row: 11, col: 11 },
    ];
  }
  if (size === 19) {
    return [3, 9, 15].flatMap((row) => [3, 9, 15].map((col) => ({ row, col })));
  }
  return [];
}

const at = (index: number) => PADDING + index * CELL;

type Props = {
  board: Stone[][];
  lastMove: Point | null;
  // 서버 응답을 기다리는 동안 먼저 보여주는 내 돌입니다. 확정되면 같은
  // 자리의 실제 돌로 자연스럽게 이어지고, 거부되면 사라집니다.
  pendingMove: (Point & { color: Color }) | null;
  // 내 차례이고 응답 대기 중인 수가 없을 때만 true입니다.
  interactive: boolean;
  myColor: Color | null;
  onPlace: (row: number, col: number) => void;
  onForbidden: (message: string) => void;
};

export function OmokBoard({ board, lastMove, pendingMove, interactive, myColor, onPlace, onForbidden }: Props) {
  const gradientId = useId();
  const [hover, setHover] = useState<Point | null>(null);

  const size = board.length;
  const dim = PADDING * 2 + (size - 1) * CELL;
  const gridPath = useMemo(() => {
    const end = at(size - 1);
    let path = '';
    for (let i = 0; i < size; i += 1) {
      path += `M${PADDING} ${at(i)}H${end}M${at(i)} ${PADDING}V${end}`;
    }
    return path;
  }, [size]);

  // 미리보기는 내 차례의 빈 자리에만 띄웁니다. 금수 판정은 흑에게만
  // 의미가 있고, 실제 착수 가능 여부는 서버(app/lib/omok.ts의 submitMove)가
  // 다시 검증하니 여기서는 UX용 힌트입니다.
  const ghost = interactive && myColor && hover && board[hover.row][hover.col] === null ? hover : null;
  function forbiddenAt(row: number, col: number) {
    if (myColor !== 'black') return null;
    const tempBoard = board.map((r) => [...r]);
    tempBoard[row][col] = 'black';
    return isForbiddenMove(tempBoard, row, col, 'black').reason;
  }
  const forbiddenReason = ghost ? forbiddenAt(ghost.row, ghost.col) : null;

  // 미리보기 없이 바로 누르는 경우(터치 등)에도 금수는 서버에 보내기 전에
  // 막아, 금수 자리에 대기 돌이 잠깐 놓였다 사라지지 않게 합니다.
  function handleClick(row: number, col: number) {
    if (!interactive || board[row][col] !== null) return;
    const reason = forbiddenAt(row, col);
    if (reason) {
      onForbidden(FORBIDDEN_MOVE_MESSAGES[reason]);
      return;
    }
    onPlace(row, col);
  }

  // 확정된 돌과 대기 중인 돌을 같은 key로 그려, 확정될 때 요소가 새로
  // 생기지 않게 합니다(착수 애니메이션이 두 번 재생되지 않습니다).
  const stones: Array<Point & { color: Color; pending: boolean }> = [];
  board.forEach((cells, row) => {
    cells.forEach((cell, col) => {
      if (cell) stones.push({ row, col, color: cell, pending: false });
    });
  });
  if (pendingMove && board[pendingMove.row][pendingMove.col] === null) {
    stones.push({ ...pendingMove, pending: true });
  }

  const className = [
    'omok-board',
    interactive ? 'omok-board--interactive' : '',
    forbiddenReason ? 'omok-board--forbidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <svg
        aria-label="오목판"
        onPointerLeave={() => setHover(null)}
        role="img"
        viewBox={`0 0 ${dim} ${dim}`}
      >
        <defs>
          <radialGradient cx="35%" cy="35%" id={`${gradientId}-black`} r="65%">
            <stop offset="0%" stopColor="#5a5a5a" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </radialGradient>
          <radialGradient cx="35%" cy="35%" id={`${gradientId}-white`} r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c9c9c9" />
          </radialGradient>
        </defs>

        <rect className="omok-board__wood" height={dim} width={dim} />
        <path className="omok-board__grid" d={gridPath} vectorEffect="non-scaling-stroke" />
        {starPoints(size).map(({ row, col }) => (
          <circle className="omok-board__star" cx={at(col)} cy={at(row)} key={`star-${row}-${col}`} r={3} />
        ))}

        {stones.map(({ row, col, color, pending }) => (
          <circle
            className={`omok-board__stone ${pending ? 'omok-board__stone--pending' : ''}`}
            cx={at(col)}
            cy={at(row)}
            fill={`url(#${gradientId}-${color})`}
            key={`${row}-${col}`}
            r={STONE_RADIUS}
          />
        ))}

        {lastMove && board[lastMove.row]?.[lastMove.col] && (
          <circle className="omok-board__last" cx={at(lastMove.col)} cy={at(lastMove.row)} r={3.5} />
        )}

        {ghost && myColor && !forbiddenReason && (
          <circle
            className="omok-board__ghost"
            cx={at(ghost.col)}
            cy={at(ghost.row)}
            fill={`url(#${gradientId}-${myColor})`}
            r={STONE_RADIUS}
          />
        )}
        {ghost && forbiddenReason && (
          <path
            className="omok-board__forbidden"
            d={`M${at(ghost.col) - 8} ${at(ghost.row) - 8}l16 16m0 -16l-16 16`}
          />
        )}

        {/* 교차점마다 투명한 클릭 영역을 둡니다. 좌표 변환 없이 칸을 바로 압니다.
            상대 차례에도 커서 위치를 계속 따라가야 내 차례가 됐을 때 미리보기가
            엉뚱한 자리에 남지 않습니다. */}
        {board.map((cells, row) => cells.map((_, col) => (
          <rect
            className="omok-board__hit"
            height={CELL}
            key={`hit-${row}-${col}`}
            onClick={() => handleClick(row, col)}
            onPointerEnter={() => setHover({ row, col })}
            width={CELL}
            x={at(col) - CELL / 2}
            y={at(row) - CELL / 2}
          />
        )))}
      </svg>
    </div>
  );
}
