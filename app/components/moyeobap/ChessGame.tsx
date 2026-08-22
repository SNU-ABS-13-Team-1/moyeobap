'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { DIFFICULTY_LABEL, DIFFICULTY_MULTIPLIER, pickCpuMove, type Difficulty } from '../../lib/chessAi';
import { ChessBoard, colorLabel } from './ChessBoard';
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

const HUMAN_COLOR: Color = 'w';
const CPU_THINK_MS = 350;

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

/** 빠르게 이길수록, 어려운 상대일수록 높은 점수. (기본 300-3×수, 최소 10) × 난이도 배율 */
function winScore(fullMoves: number, difficulty: Difficulty): number {
  return Math.round(Math.max(10, 300 - fullMoves * 3) * DIFFICULTY_MULTIPLIER[difficulty]);
}

const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

export function ChessGame() {
  const [game, setGame] = useState<Chess>(() => new Chess());
  const { currentUser } = useAuth();
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR<LeaderboardResponse>(
    LEADERBOARD_URL,
    fetcher,
  );

  const [mode, setMode] = useState<Mode>('cpu');
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
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

  const targetSquares = useMemo(() => {
    const map = new Map<Square, boolean>();
    legalTargets.forEach((move, square) => map.set(square, Boolean(move.captured)));
    return map;
  }, [legalTargets]);

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
    const score = winScore(game.moveNumber(), difficulty);
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

  function handleNewGame(nextMode: Mode = mode, nextDifficulty: Difficulty = difficulty) {
    const fresh = new Chess();
    setGame(fresh);
    setMode(nextMode);
    setDifficulty(nextDifficulty);
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
      const move = pickCpuMove(game, difficulty);
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
        {mode === 'cpu' ? ` 나는 백(아래), 컴퓨터(${DIFFICULTY_LABEL[difficulty]})는 흑이에요. 난이도를 바꾸면 새 게임이 시작돼요.` : ' 한 기기에서 둘이 번갈아 두는 모드예요.'}
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

      {mode === 'cpu' && (
        <div className="chess__toolbar chess__toolbar--levels" role="group" aria-label="컴퓨터 난이도">
          <span className="chess__toolbar-label">난이도</span>
          {DIFFICULTIES.map((level) => (
            <button
              className={`chess__mode-btn ${difficulty === level ? 'chess__mode-btn--active' : ''}`}
              key={level}
              onClick={() => handleNewGame('cpu', level)}
              type="button"
            >
              {DIFFICULTY_LABEL[level]}
            </button>
          ))}
        </div>
      )}

      <div className={`chess__status ${outcome.kind !== 'playing' ? 'chess__status--over' : ''}`} aria-live="polite">
        {statusText}
        <span className="chess__move-no">{game.moveNumber()}수</span>
      </div>

      <ChessBoard
        board={board}
        checkSquare={kingInCheckSquare}
        disabled={!humanCanMove}
        lastMove={lastMove}
        onSquareClick={handleSquareClick}
        selected={selected}
        targets={targetSquares}
      />

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
        <p className="chess__saved">랭킹에 {savedScore}점이 기록됐어요. (빠르게 이길수록, 어려운 난이도일수록 높은 점수)</p>
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
