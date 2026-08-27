'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { DIFFICULTY_LABEL, pickCpuMove, type Difficulty } from '../../lib/chessAi';
import type { ChessAiRequest, ChessAiResponse } from '../../lib/chessAi.worker';
import { readPersonalBest, savePersonalBest } from '../../lib/personalBest';
import { ChessBoard } from './ChessBoard';
import { PromotionPicker, type PromotionPiece } from './PromotionPicker';

// 컴퓨터와 두는 체스(난이도 5단계). 연습용이라 랭킹이 없습니다 — 점수는 서버로
// 보내지 않고, 내 최고 기록만 이 브라우저에 남습니다. 남 눈치 볼 일 없이
// 편하게 두시라고 이렇게 뒀습니다. 사람과 겨루려면 실시간 대전으로 가면 됩니다.

type Outcome =
  | { kind: 'playing' }
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'draw'; reason: string };

const HUMAN_COLOR: Color = 'w';
const CPU_THINK_MS = 350;
/** 이 난이도부터는 탐색이 오래 걸릴 수 있어 Web Worker에서 계산합니다. */
const WORKER_FROM_LEVEL: Difficulty = 4;
const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

const bestKey = (difficulty: Difficulty) => `chess-l${difficulty}`;

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

/** 빠르게 이길수록 높은 점수(난이도별로 기록이 따로라 배율은 없음). 최소 10점, 최대 300점. */
function winScore(fullMoves: number): number {
  return Math.max(10, 300 - fullMoves * 3);
}

export function ChessGame() {
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [fen, setFen] = useState(() => game.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  // 최고 기록은 이 브라우저에만 남습니다(서버로 안 보냅니다).
  const [best, setBest] = useState<{ best: number; isNew: boolean } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const turn = game.turn();
  const outcome = useMemo(() => readOutcome(game), [game, fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const inCheck = outcome.kind === 'playing' && game.isCheck();
  const board = useMemo(() => game.board(), [game, fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const isCpuTurn = turn !== HUMAN_COLOR && outcome.kind === 'playing';
  // 컴퓨터 차례인 동안은 "생각 중"으로 취급해 입력을 막습니다(별도 상태 없이 파생).
  const thinking = isCpuTurn;
  const humanCanMove = outcome.kind === 'playing' && !thinking && turn === HUMAN_COLOR && !pendingPromotion;

  const legalTargets = useMemo(() => {
    if (!selected) return new Map<Square, Move>();
    const map = new Map<Square, Move>();
    for (const move of game.moves({ square: selected, verbose: true })) map.set(move.to, move);
    return map;
  }, [game, selected, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetSquares = useMemo(() => {
    const map = new Map<Square, boolean>();
    legalTargets.forEach((move, square) => map.set(square, Boolean(move.captured)));
    return map;
  }, [legalTargets]);

  const kingInCheckSquare = useMemo(() => {
    if (!inCheck) return null;
    for (const row of board) for (const cell of row) if (cell && cell.type === 'k' && cell.color === turn) return cell.square;
    return null;
  }, [board, inCheck, turn]);

  // Web Worker는 한 번만 만들고 페이지를 떠날 때 정리합니다. 만들 수 없는 환경이면 메인 스레드에서 계산합니다.
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../../lib/chessAi.worker.ts', import.meta.url));
    } catch {
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // localStorage는 서버 렌더에서 읽을 수 없어 마운트 뒤에 채웁니다(BgmPlayer와 같은 방식).
  useEffect(() => {
    const saved = readPersonalBest(bestKey(difficulty));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest(saved === null ? null : { best: saved, isNew: false });
  }, [difficulty]);

  function syncBoard(target: Chess = game) {
    setFen(target.fen());
  }

  function submitWinScore() {
    const score = winScore(game.moveNumber());
    setSubmitted(true);
    setSavedScore(score);
    setBest(savePersonalBest(bestKey(difficulty), score));
  }

  function applyMove(from: Square, to: Square, promotion?: PieceSymbol) {
    let moved;
    try {
      moved = game.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return;
    }
    if (!moved) return;
    setLastMove({ from: moved.from, to: moved.to });
    setSelected(null);
    setPendingPromotion(null);
    syncBoard();

    // 내 수로 체크메이트가 나면(= 이제 컴퓨터 차례인데 둘 수 없음) 점수를 한 번만 기록합니다.
    // 로그인 여부는 따지지 않습니다 — 어차피 이 브라우저에만 남습니다.
    const humanWon = game.turn() !== HUMAN_COLOR && game.isCheckmate();
    if (humanWon && !submitted) submitWinScore();
  }

  function handleNewGame(nextDifficulty: Difficulty = difficulty) {
    const fresh = new Chess();
    requestIdRef.current += 1; // 진행 중이던 워커 계산 결과는 무시
    setGame(fresh);
    setDifficulty(nextDifficulty);
    setSelected(null);
    setLastMove(null);
    setSubmitted(false);
    setSavedScore(null);
    setPendingPromotion(null);
    syncBoard(fresh);
  }

  function handleUndo() {
    if (thinking) return;
    game.undo();
    // 내 수와 컴퓨터의 응수를 함께 물립니다.
    if (game.turn() !== HUMAN_COLOR) game.undo();
    const history = game.history({ verbose: true });
    const prev = history[history.length - 1];
    setLastMove(prev ? { from: prev.from, to: prev.to } : null);
    setSelected(null);
    setPendingPromotion(null);
    setSubmitted(false);
    setSavedScore(null);
    syncBoard();
  }

  function handleSquareClick(square: Square) {
    if (!humanCanMove) return;

    if (selected) {
      const target = legalTargets.get(square);
      if (target) {
        if (target.promotion) {
          // 승격 기물은 사용자가 고릅니다.
          setPendingPromotion({ from: selected, to: square });
          return;
        }
        applyMove(selected, square);
        return;
      }
    }

    const piece = game.get(square);
    if (piece && piece.color === turn) setSelected(selected === square ? null : square);
    else setSelected(null);
  }

  function handlePromotionPick(piece: PromotionPiece) {
    if (!pendingPromotion) return;
    applyMove(pendingPromotion.from, pendingPromotion.to, piece);
  }

  // 컴퓨터 차례가 되면 잠깐 "생각"한 뒤 둡니다. 고수·프로는 워커에서, 나머지는 바로 계산합니다.
  useEffect(() => {
    if (!isCpuTurn) return;
    const requestId = ++requestIdRef.current;
    const worker = difficulty >= WORKER_FROM_LEVEL ? workerRef.current : null;

    if (worker) {
      const handleMessage = (event: MessageEvent<ChessAiResponse>) => {
        if (event.data.id !== requestId) return; // 새 게임/무르기로 무효가 된 응답
        const move = event.data.move;
        if (move) applyMove(move.from as Square, move.to as Square, move.promotion as PieceSymbol | undefined);
      };
      worker.addEventListener('message', handleMessage);
      const request: ChessAiRequest = { id: requestId, fen: game.fen(), difficulty };
      worker.postMessage(request);
      return () => {
        worker.removeEventListener('message', handleMessage);
      };
    }

    const timer = setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      const move = pickCpuMove(game, difficulty);
      if (move) applyMove(move.from, move.to, move.promotion);
    }, CPU_THINK_MS);
    return () => clearTimeout(timer);
    // fen이 바뀔 때마다(=내가 둘 때마다) 컴퓨터 차례인지 다시 판단합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCpuTurn, fen]);

  const statusText = (() => {
    if (outcome.kind === 'checkmate') return outcome.winner === HUMAN_COLOR ? '체크메이트! 🎉 이겼어요' : '체크메이트… 컴퓨터가 이겼어요';
    if (outcome.kind === 'draw') return `무승부 (${outcome.reason})`;
    if (pendingPromotion) return '승격할 기물을 고르세요';
    if (thinking) return `컴퓨터(${DIFFICULTY_LABEL[difficulty]})가 생각 중…`;
    return inCheck ? '내 차례 — 체크!' : '내 차례';
  })();

  return (
    <div className="chess">
      <p className="chess__desc">
        기물을 누르면 갈 수 있는 칸이 표시돼요. 나는 백(아래), 컴퓨터는 흑이에요. 난이도를 바꾸면 새 게임이 시작돼요.
      </p>

      <div className="chess__toolbar chess__toolbar--levels" role="group" aria-label="컴퓨터 난이도">
        <span className="chess__toolbar-label">난이도</span>
        {DIFFICULTIES.map((level) => (
          <button
            className={`chess__mode-btn ${difficulty === level ? 'chess__mode-btn--active' : ''}`}
            key={level}
            onClick={() => handleNewGame(level)}
            type="button"
          >
            {DIFFICULTY_LABEL[level]}
          </button>
        ))}
      </div>

      <div className={`chess__status ${outcome.kind !== 'playing' ? 'chess__status--over' : ''}`} aria-live="polite">
        {statusText}
        <span className="chess__move-no">{game.moveNumber()}수</span>
      </div>

      <div className="chess__board-wrap">
        <ChessBoard
          board={board}
          checkSquare={kingInCheckSquare}
          disabled={!humanCanMove}
          lastMove={lastMove}
          onSquareClick={handleSquareClick}
          selected={selected}
          targets={targetSquares}
        />
        {pendingPromotion && (
          <PromotionPicker color={HUMAN_COLOR} onCancel={() => setPendingPromotion(null)} onPick={handlePromotionPick} />
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
        <p className="chess__saved">
          이번 판 {savedScore}점 (빠르게 이길수록 높아요)
          {best && !best.isNew && ` · 내 최고 ${best.best}점`}
          {best?.isNew && ' · 내 최고 기록이에요! 🎉'}
        </p>
      )}

      <p className="chess__practice-note">
        여기는 연습이라 랭킹이 없어요. 점수는 이 브라우저에만 남고 아무도 볼 수 없어요.
      </p>
    </div>
  );
}
