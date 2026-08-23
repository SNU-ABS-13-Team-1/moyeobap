'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Chess, type Square } from 'chess.js';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  END_REASON_LABEL,
  TIME_CONTROL_LABEL,
  isClockExpired,
  remainingMsFor,
  type ChessEndReason,
  type ChessWinner,
  type ClockState,
  type TimeControl,
} from '../../lib/chessMatch';
import { useAuth } from './AuthProvider';
import { ChessBoard } from './ChessBoard';
import { ChessChat } from './ChessChat';
import { PromotionPicker, type PromotionPiece } from './PromotionPicker';

type ChessRoomData = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'finished';
  whiteId: string;
  whiteName: string;
  blackId: string | null;
  blackName: string | null;
  fen: string;
  moves: string[];
  turn: 'w' | 'b';
  winner: ChessWinner;
  endReason: ChessEndReason;
  moveCount: number;
  lastFrom: string | null;
  lastTo: string | null;
  timeControl: TimeControl;
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  drawOfferBy: string | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
};

const DISCONNECT_CLAIM_DELAY_MS = 60_000;
const RECONNECT_NOTICE_MS = 4_000;

function formatClock(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// 오목 방(OmokRoom)과 같은 구조입니다: 2초 폴링 + Realtime 구독으로 방 상태를
// 받고, Presence로 상대 접속 여부와 관전자를 추적합니다. 보드 규칙은 chess.js가
// 담당하고, 실제 착수 검증은 서버(app/lib/chessOnline.ts)가 다시 합니다.
export function ChessRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [drawPending, setDrawPending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [moveError, setMoveError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);
  const { data, error, mutate } = useSWR<{ room: ChessRoomData }>(`/api/games/chess/rooms/${roomId}`, fetcher, {
    refreshInterval: 2000,
  });
  const room = data?.room;

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }
    const channel = supabase
      .channel(`chess-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chess_rooms', filter: `id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  const myColor: 'w' | 'b' | null =
    currentUser?.id === room?.whiteId ? 'w' : currentUser?.id === room?.blackId ? 'b' : null;
  const isMyTurn = Boolean(room) && myColor !== null && room!.status === 'playing' && room!.turn === myColor;

  // 현재 국면은 서버가 준 FEN으로 복원합니다(이력 기반 판정은 서버 몫).
  const game = useMemo(() => {
    try {
      return new Chess(room?.fen);
    } catch {
      return new Chess();
    }
  }, [room?.fen]);
  const board = useMemo(() => game.board(), [game]);
  const inCheck = room?.status === 'playing' && game.isCheck();
  const checkSquare = useMemo(() => {
    if (!inCheck) return null;
    for (const row of board) for (const cell of row) if (cell && cell.type === 'k' && cell.color === game.turn()) return cell.square;
    return null;
  }, [board, inCheck, game]);

  const legalMoves = useMemo(
    () => (selected && isMyTurn ? game.moves({ square: selected, verbose: true }) : []),
    [game, selected, isMyTurn],
  );
  const targets = useMemo(() => {
    const map = new Map<Square, boolean>();
    for (const move of legalMoves) map.set(move.to, Boolean(move.captured));
    return map;
  }, [legalMoves]);

  // Presence: 참여자 온라인 여부 + 관전자 목록. 상대가 끊겼다가 돌아오면 짧게 알려줍니다.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [spectators, setSpectators] = useState<string[]>([]);
  const previousOnlineRef = useRef<Set<string> | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const opponentId = myColor === 'w' ? room?.blackId : myColor === 'b' ? room?.whiteId : null;
  const opponentName = myColor === 'w' ? room?.blackName : myColor === 'b' ? room?.whiteName : null;

  useEffect(() => {
    if (!currentUser || !room) return undefined;
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }
    const role = currentUser.id === room.whiteId ? 'white' : currentUser.id === room.blackId ? 'black' : 'spectator';
    const channel = supabase.channel(`chess-presence-${roomId}`, { config: { presence: { key: currentUser.id } } });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ userId: string; name: string; role: string }>();
      const ids = new Set<string>();
      const names: string[] = [];
      Object.values(state).forEach((metas) => {
        metas.forEach((meta) => {
          ids.add(meta.userId);
          if (meta.role === 'spectator' && !names.includes(meta.name)) names.push(meta.name);
        });
      });

      // 이전에는 없던 상대가 다시 나타나면 "재접속" 안내를 잠깐 띄웁니다.
      const previous = previousOnlineRef.current;
      if (previous && opponentId && !previous.has(opponentId) && ids.has(opponentId)) {
        setReconnectNotice(`✅ ${opponentName ?? '상대'}님이 다시 접속했어요.`);
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = window.setTimeout(() => setReconnectNotice(null), RECONNECT_NOTICE_MS);
      }
      previousOnlineRef.current = ids;

      setOnlineUserIds(ids);
      setSpectators(names);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: currentUser.id, name: currentUser.name, role });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
    // room 전체가 아닌 참여자 id가 바뀔 때만 재구독하도록 의도적으로 좁힌 의존성입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser, room?.whiteId, room?.blackId]);

  const opponentOnline = !opponentId || onlineUserIds.has(opponentId);
  const showDisconnectBanner = Boolean(room && room.status === 'playing' && myColor !== null && opponentId && !opponentOnline);

  const [claimAvailable, setClaimAvailable] = useState(false);
  useEffect(() => {
    if (!showDisconnectBanner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClaimAvailable(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setClaimAvailable(true), DISCONNECT_CLAIM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [showDisconnectBanner]);

  useEffect(() => {
    if (!moveError) return undefined;
    const timer = window.setTimeout(() => setMoveError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [moveError]);

  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [roomStatus]);

  const clock: ClockState | null = room
    ? { timeControl: room.timeControl, turn: room.turn, whiteTimeMs: room.whiteTimeMs, blackTimeMs: room.blackTimeMs, turnStartedAt: room.turnStartedAt }
    : null;

  // 제한 시간이 지나면 서버에 알립니다(판정은 서버가 다시 함).
  const reportedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || !clock || room.status !== 'playing' || myColor === null) return undefined;
    const turnKey = room.turnStartedAt;
    if (!turnKey || !isClockExpired(clock, now)) return undefined;
    if (reportedTurnRef.current === turnKey) return undefined;

    reportedTurnRef.current = turnKey;
    let retryTimer: number | undefined;
    requestJson(`/api/games/chess/rooms/${roomId}/timeout`, { method: 'POST' })
      .then(() => mutate())
      .catch(() => {
        retryTimer = window.setTimeout(() => {
          if (reportedTurnRef.current === turnKey) reportedTurnRef.current = null;
        }, 1000);
      });
    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
    // clock은 room에서 파생된 값이라 room만 의존성에 둡니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, now, myColor, roomId, mutate]);

  // 대국 중 기권은 브라우저 확인창(confirm) 대신 화면 안에서 한 번 더 묻습니다.
  // (일부 내장 브라우저는 confirm 창을 막아 버튼이 먹지 않는 것처럼 보입니다.)
  const needsResignConfirm = room?.status === 'playing' && Boolean(myColor);
  async function handleLeaveRoom() {
    if (needsResignConfirm && !confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    setLeaving(true);
    try {
      await requestJson(`/api/games/chess/rooms/${roomId}/leave`, { method: 'POST' });
    } catch {
      // 무시하고 로비로
    }
    router.push('/games/chess/online');
  }

  async function postAction(path: 'rematch' | 'draw', action: string, setPending: (v: boolean) => void, fallback: string) {
    setPending(true);
    try {
      await requestJson(`/api/games/chess/rooms/${roomId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch (err) {
      setMoveError(getErrorMessage(err, fallback));
      mutate();
    } finally {
      setPending(false);
    }
  }

  const handleRematch = (action: 'request' | 'accept' | 'decline') =>
    postAction('rematch', action, setRematchPending, '재대국 요청을 처리하지 못했어요.');
  const handleDraw = (action: 'offer' | 'accept' | 'decline') =>
    postAction('draw', action, setDrawPending, '무승부 요청을 처리하지 못했어요.');

  async function handleClaimWin() {
    setClaiming(true);
    try {
      await requestJson(`/api/games/chess/rooms/${roomId}/claim-win`, { method: 'POST' });
      mutate();
    } catch {
      // 무시
    } finally {
      setClaiming(false);
    }
  }

  async function sendMove(from: Square, to: Square, promotion?: string) {
    // 낙관적 반영: 서버 응답 전에 내 수를 먼저 그립니다. 실패하면 mutate로 되돌립니다.
    const optimistic = new Chess(game.fen());
    try {
      optimistic.move({ from, to, promotion: promotion ?? 'q' });
      mutate(
        (prev) =>
          prev ? { room: { ...prev.room, fen: optimistic.fen(), turn: optimistic.turn(), lastFrom: from, lastTo: to } } : prev,
        false,
      );
    } catch {
      // 화면용 낙관 반영만 실패 — 서버 판정을 기다립니다.
    }
    try {
      await requestJson(`/api/games/chess/rooms/${roomId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, promotion }),
      });
      setMoveError(null);
    } catch (err) {
      setMoveError(getErrorMessage(err, '수를 두지 못했어요.'));
    }
    mutate();
  }

  function handleSquareClick(square: Square) {
    if (!room || !isMyTurn || pendingPromotion) return;
    if (selected && targets.has(square)) {
      const move = legalMoves.find((m) => m.to === square);
      if (move?.promotion) {
        setPendingPromotion({ from: selected, to: square });
        return;
      }
      setSelected(null);
      sendMove(selected, square);
      return;
    }
    const piece = game.get(square);
    if (piece && piece.color === myColor) setSelected(selected === square ? null : square);
    else setSelected(null);
  }

  function handlePromotionPick(piece: PromotionPiece) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    setSelected(null);
    sendMove(from, to, piece);
  }

  if (error) return <div className="omok-room__state">방을 불러오지 못했어요.</div>;
  if (!room || !clock) return <div className="omok-room__state">불러오는 중...</div>;

  let statusText: string;
  const reasonText = room.endReason ? ` (${END_REASON_LABEL[room.endReason]})` : '';
  if (room.status === 'waiting') {
    statusText = '상대를 기다리는 중이에요. 로비에 방이 보이니 곧 들어올 거예요.';
  } else if (room.status === 'finished') {
    if (room.winner === 'draw') statusText = `무승부예요${reasonText}`;
    else if (myColor) {
      const iWon = (room.winner === 'white' && myColor === 'w') || (room.winner === 'black' && myColor === 'b');
      statusText = iWon ? `🎉 승리했어요!${reasonText}` : `아쉽게 패배했어요${reasonText}`;
    } else statusText = `${room.winner === 'white' ? room.whiteName : room.blackName}님 승리${reasonText}`;
  } else if (pendingPromotion) {
    statusText = '승격할 기물을 고르세요';
  } else if (myColor) {
    statusText = isMyTurn ? (inCheck ? '🟢 내 턴 — 체크!' : '🟢 현재 내 턴입니다.') : '🔴 상대방의 턴입니다.';
  } else {
    statusText = `${room.turn === 'w' ? room.whiteName : room.blackName}님 차례예요${inCheck ? ' (체크)' : ''}`;
  }

  const showClocks = room.status === 'playing' && room.timeControl !== 'none';
  const whiteRemaining = remainingMsFor(clock, 'w', now);
  const blackRemaining = remainingMsFor(clock, 'b', now);
  const isTotal = room.timeControl.startsWith('total');

  const isParticipant = myColor !== null;
  const canRematch = room.status === 'finished' && isParticipant && Boolean(room.blackId);
  const rematchByMe = Boolean(room.rematchBy) && room.rematchBy === currentUser?.id;
  const rematchByOpponent = Boolean(room.rematchBy) && room.rematchBy !== currentUser?.id;
  const rematchRequesterName = room.rematchBy === room.whiteId ? room.whiteName : room.blackName;

  const canOfferDraw = room.status === 'playing' && isParticipant;
  const drawByMe = Boolean(room.drawOfferBy) && room.drawOfferBy === currentUser?.id;
  const drawByOpponent = Boolean(room.drawOfferBy) && room.drawOfferBy !== currentUser?.id;
  const drawOffererName = room.drawOfferBy === room.whiteId ? room.whiteName : room.blackName;

  const lastMove = room.lastFrom && room.lastTo ? { from: room.lastFrom, to: room.lastTo } : null;

  function renderClock(ms: number | null, active: boolean) {
    if (ms === null) return null;
    const urgent = active && ms <= 10_000;
    return <span className={`chess-room__clock ${active ? 'chess-room__clock--active' : ''} ${urgent ? 'chess-room__clock--urgent' : ''}`}>⏱ {formatClock(ms)}</span>;
  }

  return (
    <div className="omok-room-page__layout">
      <div className="omok-room-page__main">
        <div className="omok-room">
          <div className="omok-room__header">
            <h2 className="omok-room__name">{room.roomName}</h2>
            <span className="chess-room__tc">⏱ {TIME_CONTROL_LABEL[room.timeControl]}</span>
            {spectators.length > 0 && (
              <span className="omok-room__spectators" title={spectators.join(', ')}>
                👀 관전 {spectators.length}명
              </span>
            )}
          </div>

          <div className="omok-room__players">
            <span className={`omok-room__player omok-room__player--white ${room.turn === 'w' && room.status === 'playing' ? 'omok-room__player--active' : ''}`}>
              ♔ {room.whiteName}
              {showClocks && (isTotal || room.turn === 'w') ? renderClock(whiteRemaining, room.turn === 'w') : null}
            </span>
            <span className="omok-room__vs">vs</span>
            <span className={`omok-room__player omok-room__player--black ${room.turn === 'b' && room.status === 'playing' ? 'omok-room__player--active' : ''}`}>
              ♚ {room.blackName ?? '(대기 중)'}
              {showClocks && (isTotal || room.turn === 'b') ? renderClock(blackRemaining, room.turn === 'b') : null}
            </span>
          </div>

          <p className="omok-room__status">{statusText}</p>

          {reconnectNotice && <p className="chess-room__notice">{reconnectNotice}</p>}

          {showDisconnectBanner && (
            <div className="omok-room__disconnect-banner">
              <span>⚠️ {opponentName}님의 연결이 끊어졌습니다. 재접속을 기다리는 중이에요.</span>
              {claimAvailable && (
                <button disabled={claiming} onClick={handleClaimWin} type="button">
                  {claiming ? '처리 중...' : '몰수승 처리'}
                </button>
              )}
            </div>
          )}

          {canOfferDraw && drawByOpponent && (
            <div className="omok-room__rematch-offer">
              <span>{drawOffererName}님이 무승부를 제안했어요.</span>
              <div className="omok-room__rematch-offer-actions">
                <button className="omok-room__restart-btn" disabled={drawPending} onClick={() => handleDraw('accept')} type="button">
                  수락 (합의 무승부)
                </button>
                <button className="omok-room__rematch-cancel-btn" disabled={drawPending} onClick={() => handleDraw('decline')} type="button">
                  거절
                </button>
              </div>
            </div>
          )}

          <div className="chess-room__board chess__board-wrap">
            <ChessBoard
              board={board}
              checkSquare={checkSquare}
              disabled={!isMyTurn || Boolean(pendingPromotion)}
              lastMove={lastMove}
              onSquareClick={handleSquareClick}
              orientation={myColor === 'b' ? 'b' : 'w'}
              selected={selected}
              targets={targets}
            />
            {pendingPromotion && myColor && (
              <PromotionPicker color={myColor} onCancel={() => setPendingPromotion(null)} onPick={handlePromotionPick} />
            )}
          </div>

          {room.moves.length > 0 && (
            <p className="chess-room__moves">
              {room.moves.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(' ')}
            </p>
          )}

          {moveError && <p className="omok-room__move-error">{moveError}</p>}

          <div className="omok-room__actions">
            {needsResignConfirm && confirmingLeave ? (
              <span className="rummy__confirm" role="alertdialog" aria-label="기권 확인">
                정말 기권할까요? 상대의 승리로 기록돼요.
                <button className="rummy__btn rummy__btn--danger" disabled={leaving} onClick={handleLeaveRoom} type="button">
                  {leaving ? '나가는 중...' : '기권'}
                </button>
                <button className="rummy__btn rummy__btn--ghost" disabled={leaving} onClick={() => setConfirmingLeave(false)} type="button">
                  취소
                </button>
              </span>
            ) : (
              <button className="omok-room__leave-btn" disabled={leaving} onClick={handleLeaveRoom} type="button">
                {leaving ? '나가는 중...' : needsResignConfirm ? '기권하고 나가기' : '게임 나가기'}
              </button>
            )}
            {canOfferDraw && !room.drawOfferBy && (
              <button className="omok-room__rematch-cancel-btn" disabled={drawPending} onClick={() => handleDraw('offer')} type="button">
                {drawPending ? '제안하는 중...' : '무승부 제안'}
              </button>
            )}
            {canOfferDraw && drawByMe && (
              <button className="omok-room__rematch-cancel-btn" disabled={drawPending} onClick={() => handleDraw('decline')} type="button">
                무승부 제안 취소
              </button>
            )}
            {canRematch && !room.rematchBy && (
              <button className="omok-room__restart-btn" disabled={rematchPending} onClick={() => handleRematch('request')} type="button">
                {rematchPending ? '신청하는 중...' : '재대국 신청'}
              </button>
            )}
            {canRematch && rematchByMe && (
              <button className="omok-room__rematch-cancel-btn" disabled={rematchPending} onClick={() => handleRematch('decline')} type="button">
                신청 취소
              </button>
            )}
          </div>

          {canOfferDraw && drawByMe && <p className="omok-room__rematch-waiting">무승부를 제안했어요. 상대의 답을 기다리는 중이에요.</p>}

          {canRematch && rematchByMe && (
            <p className="omok-room__rematch-waiting">재대국을 신청했어요. 상대의 수락을 기다리는 중이에요.</p>
          )}

          {canRematch && rematchByOpponent && (
            <div className="omok-room__rematch-offer">
              <span>{rematchRequesterName}님이 재대국을 신청했어요. 백흑을 바꿔서 다시 둡니다.</span>
              <div className="omok-room__rematch-offer-actions">
                <button className="omok-room__restart-btn" disabled={rematchPending} onClick={() => handleRematch('accept')} type="button">
                  {rematchPending ? '시작하는 중...' : '수락'}
                </button>
                <button className="omok-room__rematch-cancel-btn" disabled={rematchPending} onClick={() => handleRematch('decline')} type="button">
                  거절
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="omok-room-page__chat">
        <ChessChat myRole={myColor === 'w' ? 'white' : myColor === 'b' ? 'black' : 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}
