'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { fetcher } from '../../lib/fetcher';
import { requestJson } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

const GAME_KEY = 'chess';
const LEADERBOARD_URL = `/api/games/${GAME_KEY}/scores`;

type ScoreEntry = { userId: string; userName: string; bestScore: number };
type LeaderboardResponse = { leaderboard: ScoreEntry[]; myRank: number | null };

type Mode = 'cpu' | 'local';
type Outcome =
  | { kind: 'playing' }
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'draw'; reason: string };

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const HUMAN_COLOR: Color = 'w';
const CPU_THINK_MS = 450;

const PIECE_GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * 컴퓨터 상대의 수 고르기. 체스 엔진이 아니라 "한 수 앞만 보는" 간단한 규칙입니다.
 * 1) 바로 체크메이트가 되는 수 2) 가치 높은 기물을 잡는 수 3) 프로모션·체크 순으로
 * 점수를 매기고, 같은 점수면 무작위로 고릅니다. 초보자가 연습하기에 적당한 수준입니다.
 */
function pickCpuMove(game: Chess): Move | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  let best: Move[] = [];
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = Math.random() * 0.5;
    if (move.captured) score += PIECE_VALUE[move.captured] * 10;
    if (move.promotion) score += 80;

    const probe = new Chess(game.fen());
    probe.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
    if (probe.isCheckmate()) score += 10_000;
    else if (probe.isCheck()) score += 4;

    // 옮긴 기물이 바로 잡힐 수 있으면 감점(아주 단순한 안전 확인).
    const attacked = probe.moves({ verbose: true }).some((reply) => reply.to === move.to && reply.captured);
    if (attacked) score -= PIECE_VALUE[move.piece] * 8;

    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [move];
    } else if (Math.abs(score - bestScore) < 1e-9) {
      best.push(move);
    }
  }

  return best[Math.floor(Math.random() * best.length)] ?? null;
}

function readOutcome(game: Chess): Outcome {
  if (game.isCheckmate()) {
    // 체크메이트면 "지금 둘 차례"인 쪽이 진 것입니다.
    return { kind: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
  }
  if (game.isStalemate()) return { kind: 'draw', reason: '스테일메이트' };
  if (game.isThreefoldRepetition()) return { kind: 'draw', reason: '같은 국면 3회 반복' };
  if (game.isInsufficientMaterial()) return { kind: 'draw', reason: '기물 부족' };
  if (game.isDraw()) return { kind: 'draw', reason: '50수 규칙' };
  return { kind: 'playing' };
}

/** 빠르게 이길수록 높은 점수. 최소 10점, 최대 300점. */
function winScore(fullMoves: number): number {
  return Math.max(10, 300 - fullMoves * 3);
}

function colorLabel(color: Color): string {
  return color === 'w' ? '백' : '흑';
}

export function ChessGame() {
  const [game, setGame] = useState<Chess>(() => new Chess());
  const { currentUser } = useAuth();
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR<LeaderboardResponse>(
    LEADERBOARD_URL,
    fetcher,
  );

  const [mode, setMode] = useState<Mode>('cpu');
  const [fen, setFen] = useState(() => game.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);

  const turn = game.turn();
  const outcome = useMemo(() => readOutcome(game), [game, fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const inCheck = outcome.kind === 'playing' && game.isCheck();
  const board = useMemo(() => game.board(), [game, fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const isCpuTurn = mode === 'cpu' && turn !== HUMAN_COLOR && outcome.kind === 'playing';
  // 컴퓨터 차례인 동안은 "생각 중"으로 취급해 입력을 막습니다(별도 상태 없이 파생).
  const thinking = isCpuTurn;
  const humanCanMove = outcome.kind === 'playing' && !thinking && (mode === 'local' || turn === HUMAN_COLOR);

  const legalTargets = useMemo(() => {
    if (!selected) return new Map<Square, Move>();
    const map = new Map<Square, Move>();
    for (const move of game.moves({ square: selected, verbose: true })) {
      map.set(move.to, move);
    }
    return map;
  }, [game, selected, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const kingInCheckSquare = useMemo(() => {
    if (!inCheck) return null;
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === turn) return cell.square;
      }
    }
    return null;
  }, [board, inCheck, turn]);

  function syncBoard(target: Chess = game) {
    setFen(target.fen());
  }

  function submitWinScore() {
    const score = winScore(game.moveNumber());
    setSubmitted(true);
    requestJson(LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    })
      .then(() => {
        setSavedScore(score);
        mutateLeaderboard();
      })
      .catch(() => null);
  }

  function applyMove(from: Square, to: Square, promotion?: PieceSymbol) {
    const moved = game.move({ from, to, promotion: promotion ?? 'q' });
    if (!moved) return;
    setLastMove({ from: moved.from, to: moved.to });
    setSelected(null);
    syncBoard();

    // 컴퓨터 모드에서 내 수로 체크메이트가 나면(= 이제 컴퓨터 차례인데 둘 수 없음) 점수를 한 번만 기록합니다.
    const humanWon = mode === 'cpu' && game.turn() !== HUMAN_COLOR && game.isCheckmate();
    if (humanWon && currentUser && !submitted) submitWinScore();
  }

  function handleNewGame(nextMode: Mode = mode) {
    const fresh = new Chess();
    setGame(fresh);
    setMode(nextMode);
    setSelected(null);
    setLastMove(null);
    setSubmitted(false);
    setSavedScore(null);
    syncBoard(fresh);
  }

  function handleUndo() {
    if (thinking) return;
    const current = game;
    current.undo();
    // 컴퓨터 모드에서는 내 수와 컴퓨터의 응수를 함께 물립니다.
    if (mode === 'cpu' && current.turn() !== HUMAN_COLOR) current.undo();
    const history = current.history({ verbose: true });
    const prev = history[history.length - 1];
    setLastMove(prev ? { from: prev.from, to: prev.to } : null);
    setSelected(null);
    setSubmitted(false);
    setSavedScore(null);
    syncBoard();
  }

  function handleSquareClick(square: Square) {
    if (!humanCanMove) return;

    if (selected) {
      const target = legalTargets.get(square);
      if (target) {
        applyMove(selected, square, target.promotion);
        return;
      }
    }

    const piece = game.get(square);
    if (piece && piece.color === turn) {
      setSelected(selected === square ? null : square);
    } else {
      setSelected(null);
    }
  }

  // 컴퓨터 차례가 되면 잠깐 "생각"한 뒤 둡니다.
  useEffect(() => {
    if (!isCpuTurn) return;
    const timer = setTimeout(() => {
      const move = pickCpuMove(game);
      if (move) applyMove(move.from, move.to, move.promotion);
    }, CPU_THINK_MS);
    return () => clearTimeout(timer);
    // fen이 바뀔 때마다(=내가 둘 때마다) 컴퓨터 차례인지 다시 판단합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCpuTurn, fen]);

  const statusText = (() => {
    if (outcome.kind === 'checkmate') {
      const winner = colorLabel(outcome.winner);
      if (mode === 'cpu') return outcome.winner === HUMAN_COLOR ? '체크메이트! 🎉 이겼어요' : '체크메이트… 컴퓨터가 이겼어요';
      return `체크메이트! ${winner} 승리`;
    }
    if (outcome.kind === 'draw') return `무승부 (${outcome.reason})`;
    if (thinking) return '컴퓨터가 생각 중…';
    const who = mode === 'cpu' ? (turn === HUMAN_COLOR ? '내 차례' : '컴퓨터 차례') : `${colorLabel(turn)} 차례`;
    return inCheck ? `${who} — 체크!` : who;
  })();

  return (
    <div className="chess">
      <p className="chess__desc">
        기물을 누르면 갈 수 있는 칸이 표시돼요. 폰이 끝까지 가면 자동으로 퀸이 됩니다.
        {mode === 'cpu' ? ' 나는 백(아래), 컴퓨터는 흑이에요.' : ' 한 기기에서 둘이 번갈아 두는 모드예요.'}
      </p>

      <div className="chess__toolbar" role="group" aria-label="게임 모드">
        <button
          className={`chess__mode-btn ${mode === 'cpu' ? 'chess__mode-btn--active' : ''}`}
          onClick={() => handleNewGame('cpu')}
          type="button"
        >
          컴퓨터와 대결
        </button>
        <button
          className={`chess__mode-btn ${mode === 'local' ? 'chess__mode-btn--active' : ''}`}
          onClick={() => handleNewGame('local')}
          type="button"
        >
          둘이서 번갈아
        </button>
      </div>

      <div className={`chess__status ${outcome.kind !== 'playing' ? 'chess__status--over' : ''}`} aria-live="polite">
        {statusText}
        <span className="chess__move-no">{game.moveNumber()}수</span>
      </div>

      <div className="chess__board" role="grid" aria-label="체스판">
        {board.map((row, rankIndex) =>
          row.map((cell, fileIndex) => {
            const square = `${FILES[fileIndex]}${8 - rankIndex}` as Square;
            const isDark = (rankIndex + fileIndex) % 2 === 1;
            const target = legalTargets.get(square);
            const classes = [
              'chess__square',
              isDark ? 'chess__square--dark' : 'chess__square--light',
              selected === square ? 'chess__square--selected' : '',
              lastMove && (lastMove.from === square || lastMove.to === square) ? 'chess__square--last' : '',
              target ? (target.captured ? 'chess__square--capture' : 'chess__square--target') : '',
              kingInCheckSquare === square ? 'chess__square--check' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                aria-label={`${square}${cell ? ` ${colorLabel(cell.color)} ${cell.type}` : ''}`}
                className={classes}
                disabled={!humanCanMove}
                key={square}
                onClick={() => handleSquareClick(square)}
                type="button"
              >
                {cell && (
                  <span className={`chess__piece chess__piece--${cell.color}`} aria-hidden="true">
                    {PIECE_GLYPH[cell.color][cell.type]}
                  </span>
                )}
                {fileIndex === 0 && <span className="chess__coord chess__coord--rank">{8 - rankIndex}</span>}
                {rankIndex === 7 && <span className="chess__coord chess__coord--file">{FILES[fileIndex]}</span>}
              </button>
            );
          }),
        )}
      </div>

      <div className="chess__actions">
        <button className="chess__btn" onClick={() => handleNewGame()} type="button">
          새 게임
        </button>
        <button
          className="chess__btn chess__btn--ghost"
          disabled={thinking || game.history().length === 0}
          onClick={handleUndo}
          type="button"
        >
          한 수 무르기
        </button>
      </div>

      {savedScore !== null && (
        <p className="chess__saved">랭킹에 {savedScore}점이 기록됐어요. (빠르게 이길수록 높은 점수)</p>
      )}

      <div className="chess__leaderboard">
        <p className="chess__leaderboard-title">🏆 랭킹 (컴퓨터 상대 최고 점수)</p>
        {!currentUser && (
          <p className="chess__leaderboard-note">로그인하면 컴퓨터를 이겼을 때 점수가 랭킹에 기록돼요.</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length === 0 && (
          <p className="chess__leaderboard-note">아직 기록이 없어요. 첫 승리를 남겨보세요!</p>
        )}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <ol className="chess__leaderboard-list">
            {leaderboardData.leaderboard.map((entry, index) => (
              <li
                className={`chess__leaderboard-item ${currentUser?.id === entry.userId ? 'chess__leaderboard-item--me' : ''}`}
                key={entry.userId}
              >
                <span className="chess__leaderboard-rank">{index + 1}</span>
                <span className="chess__leaderboard-name">{entry.userName}</span>
                <span className="chess__leaderboard-score">{entry.bestScore}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
