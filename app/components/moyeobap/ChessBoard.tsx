'use client';

import type { Color, PieceSymbol, Square } from 'chess.js';

// 체스판 그리기 전용 컴포넌트. 규칙·상태는 밖(ChessGame / ChessRoom)에서 계산하고,
// 여기는 "어느 칸을 어떻게 칠할지"만 받아서 그립니다. 흑 플레이어에게는 판을 뒤집어
// 자기 기물이 아래에 오게 보여줍니다.

export type BoardCell = { square: Square; type: PieceSymbol; color: Color } | null;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

const PIECE_GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

export function colorLabel(color: Color): string {
  return color === 'w' ? '백' : '흑';
}

type ChessBoardProps = {
  /** chess.js의 game.board() 결과 (8랭크부터). */
  board: BoardCell[][];
  /** 'w'면 백이 아래, 'b'면 흑이 아래. */
  orientation?: Color;
  selected?: Square | null;
  /** 갈 수 있는 칸 → 잡는 수인지 여부. */
  targets?: Map<Square, boolean>;
  lastMove?: { from: string; to: string } | null;
  checkSquare?: Square | null;
  disabled?: boolean;
  onSquareClick?: (square: Square) => void;
};

export function ChessBoard({
  board,
  orientation = 'w',
  selected = null,
  targets,
  lastMove = null,
  checkSquare = null,
  disabled = false,
  onSquareClick,
}: ChessBoardProps) {
  const flipped = orientation === 'b';
  const rankIndexes = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileIndexes = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="chess__board" role="grid" aria-label="체스판">
      {rankIndexes.map((rankIndex, rowPos) =>
        fileIndexes.map((fileIndex, colPos) => {
          const cell = board[rankIndex]?.[fileIndex] ?? null;
          const square = `${FILES[fileIndex]}${8 - rankIndex}` as Square;
          const isDark = (rankIndex + fileIndex) % 2 === 1;
          const isCapture = targets?.get(square);
          const classes = [
            'chess__square',
            isDark ? 'chess__square--dark' : 'chess__square--light',
            selected === square ? 'chess__square--selected' : '',
            lastMove && (lastMove.from === square || lastMove.to === square) ? 'chess__square--last' : '',
            isCapture === undefined ? '' : isCapture ? 'chess__square--capture' : 'chess__square--target',
            checkSquare === square ? 'chess__square--check' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              aria-label={`${square}${cell ? ` ${colorLabel(cell.color)} ${cell.type}` : ''}`}
              className={classes}
              disabled={disabled}
              key={square}
              onClick={() => onSquareClick?.(square)}
              type="button"
            >
              {cell && (
                <span className={`chess__piece chess__piece--${cell.color}`} aria-hidden="true">
                  {PIECE_GLYPH[cell.color][cell.type]}
                </span>
              )}
              {colPos === 0 && <span className="chess__coord chess__coord--rank">{8 - rankIndex}</span>}
              {rowPos === 7 && <span className="chess__coord chess__coord--file">{FILES[fileIndex]}</span>}
            </button>
          );
        }),
      )}
    </div>
  );
}
