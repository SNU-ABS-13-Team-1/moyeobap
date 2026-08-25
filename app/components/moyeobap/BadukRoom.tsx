'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { TURN_LIMIT_MS, isTurnExpired, remainingTurnMs } from '../../lib/badukMatch';
import { computeScore } from '../../lib/badukScoring';
import { KOMI } from '../../lib/badukConstants';
import { useAuth } from './AuthProvider';
import { BadukChat } from './BadukChat';

type Stone = 'black' | 'white' | null;
type BadukRoomData = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'scoring' | 'finished';
  blackId: string;
  blackName: string;
  whiteId: string | null;
  whiteName: string | null;
  board: Stone[][];
  turn: 'black' | 'white';
  moveCount: number;
  passCount: number;
  capturesBlack: number;
  capturesWhite: number;
  deadStones: string[];
  blackConfirmedScore: boolean;
  whiteConfirmedScore: boolean;
  scoreOfferBy: string | null;
  winner: 'black' | 'white' | null;
  finalBlackScore: number | null;
  finalWhiteScore: number | null;
  lastRow: number | null;
  lastCol: number | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
};

const CELL_SIZE = 24;
const PADDING = 22;
const STAR_POINTS = [3, 9, 15];
const DISCONNECT_CLAIM_DELAY_MS = 60_000;

export function BadukRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, mutate } = useSWR<{ room: BadukRoomData }>(
    `/api/games/baduk/rooms/${roomId}`,
    fetcher,
    { refreshInterval: 2000 },
  );
  const room = data?.room;

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`baduk-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'baduk_rooms', filter: `id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  const myColor = currentUser?.id === room?.blackId ? 'black' : currentUser?.id === room?.whiteId ? 'white' : null;
  const isMyTurn = Boolean(room) && myColor !== null && room!.status === 'playing' && room!.turn === myColor;
  const isScoring = room?.status === 'scoring';
  const isParticipant = myColor !== null;

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [spectatorCount, setSpectatorCount] = useState(0);

  useEffect(() => {
    if (!currentUser || !room) return undefined;
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }

    const role = currentUser.id === room.blackId ? 'black' : currentUser.id === room.whiteId ? 'white' : 'spectator';
    const channel = supabase.channel(`baduk-presence-${roomId}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ userId: string; role: string }>();
      const ids = new Set<string>();
      let spectators = 0;
      Object.values(state).forEach((metas) => {
        metas.forEach((meta) => {
          ids.add(meta.userId);
          if (meta.role === 'spectator') spectators += 1;
        });
      });
      setOnlineUserIds(ids);
      setSpectatorCount(spectators);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: currentUser.id, name: currentUser.name, role });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser, room?.blackId, room?.whiteId]);

  const opponentId = myColor === 'black' ? room?.whiteId : myColor === 'white' ? room?.blackId : null;
  const opponentName = myColor === 'black' ? room?.whiteName : myColor === 'white' ? room?.blackName : null;
  const opponentOnline = !opponentId || onlineUserIds.has(opponentId);
  const showDisconnectBanner = Boolean(
    room && (room.status === 'playing' || room.status === 'scoring') && myColor !== null && opponentId && !opponentOnline,
  );

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
    if (!actionError) return undefined;
    const timer = window.setTimeout(() => setActionError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [roomStatus]);

  const reportedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || room.status !== 'playing' || myColor === null) return undefined;
    const turnKey = room.turnStartedAt;
    if (!turnKey || !isTurnExpired(turnKey, now)) return undefined;
    if (reportedTurnRef.current === turnKey) return undefined;

    reportedTurnRef.current = turnKey;
    let retryTimer: number | undefined;
    requestJson(`/api/games/baduk/rooms/${roomId}/timeout`, { method: 'POST' })
      .then(() => mutate())
      .catch(() => {
        retryTimer = window.setTimeout(() => {
          if (reportedTurnRef.current === turnKey) reportedTurnRef.current = null;
        }, 1000);
      });

    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [room, now, myColor, roomId, mutate]);

  // 격자판 + 돌 + (계가 중이면) 죽은 돌 표시를 그립니다.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !room) return;

    const size = room.board.length;
    const dim = PADDING * 2 + (size - 1) * CELL_SIZE;
    canvas.width = dim;
    canvas.height = dim;

    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, dim, dim);

    ctx.strokeStyle = 'rgba(92, 67, 37, 0.8)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 1) {
      const pos = PADDING + i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(PADDING, pos);
      ctx.lineTo(dim - PADDING, pos);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos, PADDING);
      ctx.lineTo(pos, dim - PADDING);
      ctx.stroke();
    }

    if (size === 19) {
      ctx.fillStyle = 'rgba(92, 67, 37, 0.9)';
      STAR_POINTS.forEach((r) => {
        STAR_POINTS.forEach((c) => {
          ctx.beginPath();
          ctx.arc(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    const deadSet = new Set(room.deadStones);
    room.board.forEach((rowCells, row) => {
      rowCells.forEach((cell, col) => {
        if (!cell) return;
        const isLast = room.lastRow === row && room.lastCol === col;
        const isDead = deadSet.has(`${row},${col}`);
        const x = PADDING + col * CELL_SIZE;
        const y = PADDING + row * CELL_SIZE;
        const radius = CELL_SIZE / 2 - 2;

        ctx.globalAlpha = isDead ? 0.35 : 1;
        const gradient = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, Math.max(radius, 1));
        if (cell === 'black') {
          gradient.addColorStop(0, '#5a5a5a');
          gradient.addColorStop(1, '#0a0a0a');
        } else {
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(1, '#c9c9c9');
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (isLast && !isDead) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#e0483f';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (isDead) {
          ctx.strokeStyle = '#e0483f';
          ctx.lineWidth = 2;
          const r = radius - 3;
          ctx.beginPath();
          ctx.moveTo(x - r, y - r);
          ctx.lineTo(x + r, y + r);
          ctx.moveTo(x + r, y - r);
          ctx.lineTo(x - r, y + r);
          ctx.stroke();
        }
      });
    });
  }, [room]);

  async function handleLeaveRoom() {
    setLeaving(true);
    try {
      await requestJson(`/api/games/baduk/rooms/${roomId}/leave`, { method: 'POST' });
    } catch {
      // 무시하고 로비로 이동합니다.
    }
    router.push('/games/baduk');
  }

  async function handleRematch(action: 'request' | 'accept' | 'decline') {
    setRematchPending(true);
    try {
      await requestJson(`/api/games/baduk/rooms/${roomId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch (err) {
      setActionError(getErrorMessage(err, '재대국 요청을 처리하지 못했어요.'));
      mutate();
    } finally {
      setRematchPending(false);
    }
  }

  async function handleClaimWin() {
    setClaiming(true);
    try {
      await requestJson(`/api/games/baduk/rooms/${roomId}/claim-win`, { method: 'POST' });
      mutate();
    } catch {
      // 무시
    } finally {
      setClaiming(false);
    }
  }

  async function postAction(path: string, body?: Record<string, unknown>) {
    setActing(true);
    try {
      await requestJson(`/api/games/baduk/rooms/${roomId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      setActionError(null);
      mutate();
    } catch (err) {
      setActionError(getErrorMessage(err, '처리하지 못했어요.'));
      mutate();
    } finally {
      setActing(false);
    }
  }

  function resolveIntersection(canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }, size: number) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const col = Math.round((x - PADDING) / CELL_SIZE);
    const row = Math.round((y - PADDING) / CELL_SIZE);
    if (row < 0 || row >= size || col < 0 || col >= size) return null;

    const nearestX = PADDING + col * CELL_SIZE;
    const nearestY = PADDING + row * CELL_SIZE;
    if (Math.hypot(x - nearestX, y - nearestY) > CELL_SIZE / 2) return null;

    return { row, col };
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!room || acting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cell = resolveIntersection(canvas, event, room.board.length);
    if (!cell) return;

    if (isScoring && isParticipant) {
      if (room.board[cell.row][cell.col] === null) return;
      postAction('mark-dead', { row: cell.row, col: cell.col });
      return;
    }

    if (!isMyTurn) return;
    if (room.board[cell.row][cell.col] !== null) return;
    postAction('move', { row: cell.row, col: cell.col });
  }

  if (error) {
    return <div className="omok-room__state">방을 불러오지 못했어요.</div>;
  }
  if (!room) {
    return <div className="omok-room__state">불러오는 중...</div>;
  }

  const liveScore = isScoring ? computeScore(room.board, new Set(room.deadStones), KOMI) : null;

  let statusText: string;
  if (room.status === 'waiting') {
    statusText = '상대를 기다리는 중이에요. 로비에 방이 보이니 곧 들어올 거예요.';
  } else if (room.status === 'scoring') {
    statusText = '계가 중이에요. 죽은 돌을 클릭해서 표시하고, 서로 동의하면 끝나요.';
  } else if (room.status === 'finished') {
    if (myColor) {
      statusText = room.winner === myColor ? '🎉 승리했어요!' : '아쉽게 패배했어요.';
    } else {
      statusText = `${room.winner === 'black' ? room.blackName : room.whiteName}님 승리`;
    }
  } else if (myColor) {
    statusText = isMyTurn ? '🟢 현재 내 턴입니다.' : '🔴 상대방의 턴입니다.';
  } else {
    statusText = `${room.turn === 'black' ? room.blackName : room.whiteName}님 차례예요`;
  }

  const showClock = room.status === 'playing' && Boolean(room.turnStartedAt);
  const remainingSec = Math.ceil(remainingTurnMs(room.turnStartedAt, now) / 1000);
  const clockUrgent = remainingSec <= 10;

  const canRematch = room.status === 'finished' && isParticipant && Boolean(room.whiteId);
  const rematchRequestedByMe = Boolean(room.rematchBy) && room.rematchBy === currentUser?.id;
  const rematchRequestedByOpponent = Boolean(room.rematchBy) && room.rematchBy !== currentUser?.id;
  const rematchRequesterName = room.rematchBy === room.blackId ? room.blackName : room.whiteName;

  const canOfferScoring = room.status === 'playing' && isParticipant;
  const scoreOfferByMe = Boolean(room.scoreOfferBy) && room.scoreOfferBy === currentUser?.id;
  const scoreOfferByOpponent = Boolean(room.scoreOfferBy) && room.scoreOfferBy !== currentUser?.id;
  const scoreOffererName = room.scoreOfferBy === room.blackId ? room.blackName : room.whiteName;

  const myConfirmed = myColor === 'black' ? room.blackConfirmedScore : myColor === 'white' ? room.whiteConfirmedScore : false;
  const opponentConfirmed = myColor === 'black' ? room.whiteConfirmedScore : myColor === 'white' ? room.blackConfirmedScore : false;

  return (
    <div className="omok-room-page__layout">
      <div className="omok-room-page__main">
        <div className="omok-room">
          <div className="omok-room__header">
            <h2 className="omok-room__name">{room.roomName}</h2>
            {spectatorCount > 0 && <span className="omok-room__spectators">👀 관전 {spectatorCount}명</span>}
          </div>

          <div className="omok-room__players">
            <span
              className={`omok-room__player omok-room__player--black ${room.turn === 'black' && room.status === 'playing' ? 'omok-room__player--active' : ''}`}
            >
              ⚫ {room.blackName} <span className="baduk-room__captures">따냄 {room.capturesBlack}</span>
            </span>
            <span className="omok-room__vs">vs</span>
            <span
              className={`omok-room__player omok-room__player--white ${room.turn === 'white' && room.status === 'playing' ? 'omok-room__player--active' : ''}`}
            >
              ⚪ {room.whiteName ?? '(대기 중)'} <span className="baduk-room__captures">따냄 {room.capturesWhite}</span>
            </span>
          </div>

          <p className="omok-room__status">{statusText}</p>

          {showClock && (
            <p className={`omok-room__clock ${clockUrgent ? 'omok-room__clock--urgent' : ''}`}>
              ⏱ {String(Math.floor(remainingSec / 60)).padStart(2, '0')}:{String(remainingSec % 60).padStart(2, '0')}
              <span className="omok-room__clock-note">한 수 {Math.round(TURN_LIMIT_MS / 1000)}초</span>
            </p>
          )}

          {isScoring && liveScore && (
            <div className="baduk-room__score-preview">
              <span>흑 {liveScore.blackScore}집 (집 {liveScore.blackTerritory} + 돌 {liveScore.blackStones})</span>
              <span>백 {liveScore.whiteScore}집 (집 {liveScore.whiteTerritory} + 돌 {liveScore.whiteStones} + 덤 {KOMI})</span>
            </div>
          )}

          {room.status === 'finished' && room.finalBlackScore !== null && room.finalWhiteScore !== null && (
            <p className="baduk-room__final-score">
              최종 — 흑 {room.finalBlackScore}집 : 백 {room.finalWhiteScore}집
            </p>
          )}

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

          {canOfferScoring && scoreOfferByOpponent && (
            <div className="omok-room__rematch-offer">
              <span>{scoreOffererName}님이 계가를 신청했어요.</span>
              <div className="omok-room__rematch-offer-actions">
                <button className="omok-room__restart-btn" disabled={acting} onClick={() => postAction('score-offer', { action: 'accept' })} type="button">
                  수락 (계가 시작)
                </button>
                <button className="omok-room__rematch-cancel-btn" disabled={acting} onClick={() => postAction('score-offer', { action: 'decline' })} type="button">
                  거절
                </button>
              </div>
            </div>
          )}

          <div className="omok-room__canvas-wrap">
            <canvas
              className={`omok-room__canvas ${isMyTurn || (isScoring && isParticipant) ? 'omok-room__canvas--active' : ''}`}
              onClick={handleCanvasClick}
              ref={canvasRef}
            />
          </div>

          {actionError && <p className="omok-room__move-error">{actionError}</p>}

          <div className="omok-room__actions">
            <button className="omok-room__leave-btn" disabled={leaving} onClick={handleLeaveRoom} type="button">
              {leaving ? '나가는 중...' : '게임 나가기'}
            </button>

            {room.status === 'playing' && isMyTurn && (
              <button className="baduk-room__pass-btn" disabled={acting} onClick={() => postAction('pass')} type="button">
                패스
              </button>
            )}
            {canOfferScoring && !room.scoreOfferBy && (
              <button className="baduk-room__pass-btn" disabled={acting} onClick={() => postAction('score-offer', { action: 'offer' })} type="button">
                계가 신청
              </button>
            )}
            {canOfferScoring && scoreOfferByMe && (
              <button className="omok-room__rematch-cancel-btn" disabled={acting} onClick={() => postAction('score-offer', { action: 'decline' })} type="button">
                신청 취소
              </button>
            )}
            {(room.status === 'playing' || room.status === 'scoring') && isParticipant && (
              <button className="baduk-room__resign-btn" disabled={acting} onClick={() => postAction('resign')} type="button">
                기권
              </button>
            )}

            {isScoring && isParticipant && (
              <>
                <button className="omok-room__restart-btn" disabled={acting || myConfirmed} onClick={() => postAction('confirm-score')} type="button">
                  {myConfirmed ? '동의함 (상대 기다리는 중)' : '계가 동의'}
                </button>
                <button className="omok-room__rematch-cancel-btn" disabled={acting} onClick={() => postAction('resume-play')} type="button">
                  다시 두기
                </button>
              </>
            )}
            {isScoring && isParticipant && opponentConfirmed && !myConfirmed && (
              <p className="baduk-room__opponent-confirmed">상대가 이미 계가에 동의했어요.</p>
            )}

            {canRematch && !room.rematchBy && (
              <button className="omok-room__restart-btn" disabled={rematchPending} onClick={() => handleRematch('request')} type="button">
                {rematchPending ? '신청하는 중...' : '재대국 신청'}
              </button>
            )}
            {canRematch && rematchRequestedByMe && (
              <button className="omok-room__rematch-cancel-btn" disabled={rematchPending} onClick={() => handleRematch('decline')} type="button">
                신청 취소
              </button>
            )}
          </div>

          {canOfferScoring && scoreOfferByMe && (
            <p className="omok-room__rematch-waiting">계가를 신청했어요. 상대의 답을 기다리는 중이에요.</p>
          )}

          {canRematch && rematchRequestedByMe && (
            <p className="omok-room__rematch-waiting">재대국을 신청했어요. 상대의 수락을 기다리는 중이에요.</p>
          )}

          {canRematch && rematchRequestedByOpponent && (
            <div className="omok-room__rematch-offer">
              <span>{rematchRequesterName}님이 재대국을 신청했어요. 흑백을 바꿔서 다시 둡니다.</span>
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
        <BadukChat myRole={myColor ?? 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}
