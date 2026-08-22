'use client';

import type { Color, PieceSymbol } from 'chess.js';

// 폰이 마지막 줄에 도착했을 때 어떤 기물로 승격할지 고르는 작은 선택창입니다.
// 대부분 퀸이지만, 드물게 나이트(체크/포크)나 룩(스테일메이트 회피)이 정답인 국면이 있어 선택을 줍니다.

const GLYPH: Record<Color, Record<'q' | 'r' | 'b' | 'n', string>> = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
};

const LABEL: Record<'q' | 'r' | 'b' | 'n', string> = { q: '퀸', r: '룩', b: '비숍', n: '나이트' };

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export function PromotionPicker({
  color,
  onPick,
  onCancel,
}: {
  color: Color;
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  return (
    <div className="promotion" role="dialog" aria-label="승격 기물 선택">
      <p className="promotion__title">어떤 기물로 승격할까요?</p>
      <div className="promotion__choices">
        {(['q', 'r', 'b', 'n'] as const).map((piece) => (
          <button className="promotion__btn" key={piece} onClick={() => onPick(piece)} type="button">
            <span className={`promotion__glyph promotion__glyph--${color}`} aria-hidden="true">
              {GLYPH[color][piece]}
            </span>
            <span className="promotion__label">{LABEL[piece as PieceSymbol & PromotionPiece]}</span>
          </button>
        ))}
      </div>
      <button className="promotion__cancel" onClick={onCancel} type="button">
        취소
      </button>
    </div>
  );
}
