import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';

/**
 * 체스 컴퓨터 상대 — 5단계 난이도.
 *
 *  1 완전 초보: 규칙에 맞는 수 중 아무거나.
 *  2 초보:     잡을 수 있으면 가장 비싼 기물을 잡고, 아니면 아무거나.
 *  3 중수:     한 수만 내다봄 — 메이트·기물·승격·체크를 점수로 매기고, 바로 되잡히는 수는 피함.
 *  4 고수:     두 수 앞(내 수 + 상대 응수)을 읽는 미니맥스 + 기물 가치 평가.
 *  5 프로:     세 수 앞을 읽는 알파베타 탐색 + 기물 가치 + 위치 보너스(중앙 선호).
 *
 * 외부 엔진 없이 chess.js의 move/undo만으로 탐색하므로 브라우저에서 1초 안팎에 끝납니다.
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: '완전 초보',
  2: '초보',
  3: '중수',
  4: '고수',
  5: '프로',
};

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE_SCORE = 100_000;

function pick<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** 중앙에 가까울수록 보너스(폰·나이트·비숍). 0~30점. */
function centerBonus(square: string, piece: PieceSymbol): number {
  if (piece !== 'p' && piece !== 'n' && piece !== 'b') return 0;
  const file = square.charCodeAt(0) - 97; // a=0 … h=7
  const rank = Number(square[1]) - 1; // 1=0 … 8=7
  const dist = Math.abs(file - 3.5) + Math.abs(rank - 3.5); // 1 … 7
  return Math.round((7 - dist) * 5);
}

/** 현재 국면을 `side` 입장에서 평가(양수면 유리). */
function evaluate(game: Chess, side: Color, withPosition: boolean): number {
  if (game.isCheckmate()) return game.turn() === side ? -MATE_SCORE : MATE_SCORE;
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell) continue;
      let value = PIECE_VALUE[cell.type];
      if (withPosition) value += centerBonus(cell.square, cell.type);
      score += cell.color === side ? value : -value;
    }
  }
  return score;
}

/** 잡는 수·승격을 먼저 보게 정렬하면 알파베타 가지치기가 훨씬 잘 됩니다. */
function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const va = (a.captured ? PIECE_VALUE[a.captured] : 0) + (a.promotion ? 800 : 0);
    const vb = (b.captured ? PIECE_VALUE[b.captured] : 0) + (b.promotion ? 800 : 0);
    return vb - va;
  });
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, side: Color, withPosition: boolean): number {
  if (depth === 0 || game.isGameOver()) {
    const score = evaluate(game, side, withPosition);
    return game.turn() === side ? score : -score;
  }

  let best = -Infinity;
  for (const move of orderMoves(game.moves({ verbose: true }))) {
    game.move(move);
    const value = -negamax(game, depth - 1, -beta, -alpha, side, withPosition);
    game.undo();
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function searchBest(game: Chess, depth: number, withPosition: boolean): Move | null {
  const side = game.turn();
  const probe = new Chess(game.fen());
  let bestMoves: Move[] = [];
  let bestValue = -Infinity;

  for (const move of orderMoves(probe.moves({ verbose: true }))) {
    probe.move(move);
    // negamax는 "그 국면에서 둘 차례(=상대)" 기준 점수를 돌려주므로 부호를 뒤집어 내 기준으로 맞춥니다.
    const mine = -negamax(probe, depth - 1, -Infinity, Infinity, side, withPosition);
    probe.undo();
    if (mine > bestValue + 1e-9) {
      bestValue = mine;
      bestMoves = [move];
    } else if (Math.abs(mine - bestValue) < 1e-9) {
      bestMoves.push(move);
    }
  }
  return pick(bestMoves);
}

function pickRandom(game: Chess): Move | null {
  return pick(game.moves({ verbose: true }));
}

function pickGreedyCapture(game: Chess): Move | null {
  const moves = game.moves({ verbose: true });
  const captures = moves.filter((m) => m.captured);
  if (captures.length === 0) return pick(moves);
  const top = Math.max(...captures.map((m) => PIECE_VALUE[m.captured as PieceSymbol]));
  return pick(captures.filter((m) => PIECE_VALUE[m.captured as PieceSymbol] === top));
}

function pickOnePly(game: Chess): Move | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    let score = Math.random() * 0.5;
    if (move.captured) score += PIECE_VALUE[move.captured] / 10;
    if (move.promotion) score += 80;

    const probe = new Chess(game.fen());
    probe.move(move);
    if (probe.isCheckmate()) score += 10_000;
    else if (probe.isCheck()) score += 4;

    const attacked = probe.moves({ verbose: true }).some((reply) => reply.to === move.to && reply.captured);
    if (attacked) score -= PIECE_VALUE[move.piece] / 12;

    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [move];
    } else if (Math.abs(score - bestScore) < 1e-9) {
      best.push(move);
    }
  }
  return pick(best);
}

export function pickCpuMove(game: Chess, difficulty: Difficulty): Move | null {
  switch (difficulty) {
    case 1:
      return pickRandom(game);
    case 2:
      return pickGreedyCapture(game);
    case 3:
      return pickOnePly(game);
    case 4:
      return searchBest(game, 2, false);
    case 5:
      return searchBest(game, 3, true);
  }
}
