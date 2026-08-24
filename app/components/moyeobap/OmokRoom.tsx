'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { isForbiddenMove } from '../../lib/omokForbidden';
import { TURN_LIMIT_MS, isTurnExpired, remainingTurnMs } from '../../lib/omokMatch';
import { useAuth } from './AuthProvider';
import { Spectators } from './Spectators';
import { OmokChat } from './OmokChat';

type Stone = 'black' | 'white' | null;
type OmokRoomData = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'finished';
  blackId: string;
  blackName: string;
  whiteId: string | null;
  whiteName: string | null;
  board: Stone[][];
  turn: 'black' | 'white';
  winner: 'black' | 'white' | 'draw' | null;
  moveCount: number;
  lastRow: number | null;
  lastCol: number | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
};

const CELL_SIZE = 26;
const PADDING = 24;
const STAR_POINTS = [3, 9, 15];
const DISCONNECT_CLAIM_DELAY_MS = 60_000;

export function OmokRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  // 남은 시간 표시를 위해 현재 시각을 짧은 간격으로 갱신합니다. 보드를 다시
  // 그리는 effect는 room에만 의존하므로 이 렌더가 캔버스를 건드리지 않습니다.
  const [now, setNow] = useState(() => Date.now());
  const [moveError, setMoveError] = useState<string | null>(null);
  const [hoverForbiddenCell, setHoverForbiddenCell] = useState<{ row: number; col: number } | null>(null);
  const { data, error, mutate } = useSWR<{ room: OmokRoomData }>(
    `/api/games/omok/rooms/${roomId}`,
    fetcher,
    { refreshInterval: 2000 },
  );
  const room = data?.room;

  // 방 상태(보드/턴/승패) 실시간 구독 — 참여자에게는 즉시 반영되고,
  // 관전자는 위 2초 polling으로 따라잡습니다.
  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`omok-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'omok_rooms', filter: `id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  const myColor = currentUser?.id === room?.blackId ? 'black' : currentUser?.id === room?.whiteId ? 'white' : null;
  const isMyTurn = Boolean(room) && myColor !== null && room!.status === 'playing' && room!.turn === myColor;

  // Presence: 접속 중인 사람 목록(참여자 온라인 여부 + 관전자 수)을
  // 추적합니다. 방 자체를 의존성에 두면 2초 polling마다 채널이
  // 재구독되므로, 사람이 바뀔 때만 갱신되는 blackId/whiteId만 의존성으로
  // 둡니다.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [spectators, setSpectators] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser || !room) return undefined;
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }

    const role = currentUser.id === room.blackId ? 'black' : currentUser.id === room.whiteId ? 'white' : 'spectator';
    const channel = supabase.channel(`omok-presence-${roomId}`, {
      config: { presence: { key: currentUser.id } },
    });

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
    };
    // room 전체가 아닌 blackId/whiteId가 바뀔 때만 재구독하도록 의도적으로 좁힌 의존성입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser, room?.blackId, room?.whiteId]);

  const opponentId = myColor === 'black' ? room?.whiteId : myColor === 'white' ? room?.blackId : null;
  const opponentName = myColor === 'black' ? room?.whiteName : myColor === 'white' ? room?.blackName : null;
  const opponentOnline = !opponentId || onlineUserIds.has(opponentId);
  const showDisconnectBanner = Boolean(
    room && room.status === 'playing' && myColor !== null && opponentId && !opponentOnline,
  );

  const [claimAvailable, setClaimAvailable] = useState(false);
  useEffect(() => {
    // 배너가 사라지면(상대 재접속 등) 몰수승 버튼도 즉시 함께 숨겨야 합니다.
    if (!showDisconnectBanner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClaimAvailable(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setClaimAvailable(true), DISCONNECT_CLAIM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [showDisconnectBanner]);

  // 금수 안내 문구는 몇 초 뒤 자동으로 사라집니다.
  useEffect(() => {
    if (!moveError) return undefined;
    const timer = window.setTimeout(() => setMoveError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [moveError]);

  // 대국 중에만 시계를 돌립니다. 종료/대기 중에는 타이머를 걸지 않습니다.
  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [roomStatus]);

  // 제한 시간이 지나면 서버에 알립니다. 판정은 서버가 turn_started_at으로
  // 다시 하므로 이 호출은 "확인해달라"는 신호일 뿐이고, 양쪽 클라이언트가
  // 같이 호출해도 승부는 한 번만 확정됩니다. 한 차례당 한 번만 보내되,
  // 실패하면(시계 오차로 서버가 아직 이르다고 볼 때) 잠시 뒤 다시 시도합니다.
  const reportedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || room.status !== 'playing' || myColor === null) return undefined;
    const turnKey = room.turnStartedAt;
    if (!turnKey || !isTurnExpired(turnKey, now)) return undefined;
    if (reportedTurnRef.current === turnKey) return undefined;

    reportedTurnRef.current = turnKey;
    let retryTimer: number | undefined;
    requestJson(`/api/games/omok/rooms/${roomId}/timeout`, { method: 'POST' })
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

  // 캔버스에 격자판 + 돌을 그립니다. 방금 놓인 돌은 살짝 확대되며
  // 나타나는 간단한 애니메이션과 강조 테두리를 추가로 그립니다.
  const lastAnimatedMoveRef = useRef<string | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !room) return undefined;

    const size = room.board.length;
    const dim = PADDING * 2 + (size - 1) * CELL_SIZE;
    canvas.width = dim;
    canvas.height = dim;

    function draw(lastMoveScale: number) {
      if (!ctx || !room) return;
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

      room.board.forEach((rowCells, row) => {
        rowCells.forEach((cell, col) => {
          if (!cell) return;
          const isLast = room.lastRow === row && room.lastCol === col;
          const scale = isLast ? lastMoveScale : 1;
          const x = PADDING + col * CELL_SIZE;
          const y = PADDING + row * CELL_SIZE;
          const radius = (CELL_SIZE / 2 - 2) * scale;

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

          if (isLast) {
            ctx.beginPath();
            ctx.arc(x, y, CELL_SIZE / 2 - 2 + 3, 0, Math.PI * 2);
            ctx.strokeStyle = '#e0483f';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      });
    }

    if (room.moveCount === 0) lastAnimatedMoveRef.current = null;
    const moveKey = room.lastRow !== null && room.lastCol !== null ? `${room.lastRow},${room.lastCol}` : null;

    let rafId: number | null = null;
    if (moveKey && moveKey !== lastAnimatedMoveRef.current) {
      lastAnimatedMoveRef.current = moveKey;
      const start = performance.now();
      const duration = 180;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        draw(0.3 + 0.7 * progress);
        if (progress < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } else {
      draw(1);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [room]);

  // 금수 위치 마우스 오버 표시는 별도의 투명 오버레이 캔버스에만 그립니다.
  // 클릭 처리는 계속 메인 캔버스가 담당하고(오버레이는 pointer-events:none),
  // 보드 자체를 다시 그리는 애니메이션/effect와 완전히 분리해 서로 간섭하지
  // 않습니다.
  useEffect(() => {
    const canvas = hoverCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !room) return;

    const size = room.board.length;
    const dim = PADDING * 2 + (size - 1) * CELL_SIZE;
    canvas.width = dim;
    canvas.height = dim;
    ctx.clearRect(0, 0, dim, dim);

    if (!hoverForbiddenCell) return;
    const x = PADDING + hoverForbiddenCell.col * CELL_SIZE;
    const y = PADDING + hoverForbiddenCell.row * CELL_SIZE;
    ctx.strokeStyle = '#e0483f';
    ctx.lineWidth = 2;
    const r = CELL_SIZE / 2 - 3;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
  }, [room, hoverForbiddenCell]);

  async function handleLeaveRoom() {
    setLeaving(true);
    try {
      await requestJson(`/api/games/omok/rooms/${roomId}/leave`, { method: 'POST' });
    } catch {
      // 무시하고 로비로 이동합니다.
    }
    router.push('/games/omok');
  }

  // 기권은 그 판만 내주고 방에는 그대로 남습니다. 로비로 나가는 것은 대국이
  // 끝난 뒤 "게임 나가기"가 맡습니다.
  // 확인은 브라우저 confirm 대신 화면 안에서 한 번 더 묻습니다(일부 내장
  // 브라우저가 confirm 창을 막아 버튼이 먹지 않는 것처럼 보입니다).
  async function handleResign() {
    setResigning(true);
    try {
      await requestJson(`/api/games/omok/rooms/${roomId}/resign`, { method: 'POST' });
      setConfirmingResign(false);
      setMoveError(null);
    } catch (err) {
      setMoveError(getErrorMessage(err, '기권하지 못했어요.'));
    } finally {
      setResigning(false);
      mutate();
    }
  }

  async function handleRematch(action: 'request' | 'accept' | 'decline') {
    setRematchPending(true);
    try {
      await requestJson(`/api/games/omok/rooms/${roomId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch (err) {
      setMoveError(getErrorMessage(err, '재대국 요청을 처리하지 못했어요.'));
      mutate();
    } finally {
      setRematchPending(false);
    }
  }

  async function handleClaimWin() {
    setClaiming(true);
    try {
      await requestJson(`/api/games/omok/rooms/${roomId}/claim-win`, { method: 'POST' });
      mutate();
    } catch {
      // 무시
    } finally {
      setClaiming(false);
    }
  }

  async function handleMove(row: number, col: number) {
    try {
      await requestJson(`/api/games/omok/rooms/${roomId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col }),
      });
      setMoveError(null);
      mutate();
    } catch (err) {
      // 상대 차례이거나 이미 놓인 자리, 동시 착수로 인한 재시도 케이스는
      // 별도 알림 없이 무시하고 다음 polling/realtime 갱신에서 자연스럽게
      // 맞춰지지만, 금수 거부는 사용자에게 명확히 알려줍니다.
      const message = getErrorMessage(err, '');
      if (message.startsWith('금수입니다')) {
        setMoveError(message);
      }
      mutate();
    }
  }

  // 클릭/마우스오버 둘 다 캔버스 좌표 → 격자 교차점 변환이 필요해서 공유합니다.
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
    if (!room || !isMyTurn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cell = resolveIntersection(canvas, event, room.board.length);
    if (!cell || room.board[cell.row][cell.col] !== null) return;

    handleMove(cell.row, cell.col);
  }

  // 흑 차례일 때만 의미가 있는 미리보기라, 그 외에는 항상 표시를 지웁니다.
  // 실제 착수 가능 여부는 서버(app/lib/omok.ts의 submitMove)가 다시 검증하니
  // 이건 어디까지나 UX용 힌트입니다.
  function handleCanvasMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!room || !isMyTurn || myColor !== 'black') {
      if (hoverForbiddenCell) setHoverForbiddenCell(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cell = resolveIntersection(canvas, event, room.board.length);
    if (!cell || room.board[cell.row][cell.col] !== null) {
      if (hoverForbiddenCell) setHoverForbiddenCell(null);
      return;
    }

    const tempBoard = room.board.map((r) => [...r]);
    tempBoard[cell.row][cell.col] = 'black';
    const { forbidden } = isForbiddenMove(tempBoard, cell.row, cell.col, 'black');
    setHoverForbiddenCell(forbidden ? cell : null);
  }

  function handleCanvasMouseLeave() {
    if (hoverForbiddenCell) setHoverForbiddenCell(null);
  }

  if (error) {
    return <div className="omok-room__state">방을 불러오지 못했어요.</div>;
  }
  if (!room) {
    return <div className="omok-room__state">불러오는 중...</div>;
  }

  let statusText: string;
  if (room.status === 'waiting') {
    statusText = '상대를 기다리는 중이에요. 로비에 방이 보이니 곧 들어올 거예요.';
  } else if (room.status === 'finished') {
    if (room.winner === 'draw') {
      statusText = '무승부예요.';
    } else if (myColor) {
      statusText = room.winner === myColor ? '🎉 승리했어요!' : '아쉽게 패배했어요.';
    } else {
      statusText = `${room.winner === 'black' ? room.blackName : room.whiteName}님 승리`;
    }
  } else if (myColor) {
    statusText = isMyTurn ? '🟢 현재 내 턴입니다.' : '🔴 상대방의 턴입니다.';
  } else {
    statusText = `${room.turn === 'black' ? room.blackName : room.whiteName}님 차례예요`;
  }

  // 남은 시간은 내 차례든 상대 차례든 똑같이 보여줍니다. 상대가 얼마나
  // 남았는지 보이지 않으면 갑자기 시간패로 끝난 것처럼 느껴집니다.
  const showClock = room.status === 'playing' && Boolean(room.turnStartedAt);
  const remainingSec = Math.ceil(remainingTurnMs(room.turnStartedAt, now) / 1000);
  const clockUrgent = remainingSec <= 10;

  const isParticipant = myColor !== null;
  // 대국 중인 참가자만 기권할 수 있습니다(관전자·대기 중·종료 후는 제외).
  const canResign = isParticipant && room.status === 'playing';
  const canRematch = room.status === 'finished' && isParticipant && Boolean(room.whiteId);
  const rematchRequestedByMe = Boolean(room.rematchBy) && room.rematchBy === currentUser?.id;
  const rematchRequestedByOpponent = Boolean(room.rematchBy) && room.rematchBy !== currentUser?.id;
  const rematchRequesterName = room.rematchBy === room.blackId ? room.blackName : room.whiteName;

  return (
    <div className="omok-room-page__layout">
      <div className="omok-room-page__main">
        <div className="omok-room">
          <div className="omok-room__header">
            <h2 className="omok-room__name">{room.roomName}</h2>
            <Spectators names={spectators} />
          </div>

          <div className="omok-room__players">
            <span
              className={`omok-room__player omok-room__player--black ${room.turn === 'black' && room.status === 'playing' ? 'omok-room__player--active' : ''}`}
            >
              ⚫ {room.blackName}
            </span>
            <span className="omok-room__vs">vs</span>
            <span
              className={`omok-room__player omok-room__player--white ${room.turn === 'white' && room.status === 'playing' ? 'omok-room__player--active' : ''}`}
            >
              ⚪ {room.whiteName ?? '(대기 중)'}
            </span>
          </div>

          <p className="omok-room__status">{statusText}</p>

          {showClock && (
            <p className={`omok-room__clock ${clockUrgent ? 'omok-room__clock--urgent' : ''}`}>
              ⏱ {String(Math.floor(remainingSec / 60)).padStart(2, '0')}:
              {String(remainingSec % 60).padStart(2, '0')}
              <span className="omok-room__clock-note">
                한 수 {Math.round(TURN_LIMIT_MS / 1000)}초
              </span>
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

          <div className="omok-room__canvas-wrap">
            <canvas
              className={`omok-room__canvas ${isMyTurn ? 'omok-room__canvas--active' : ''} ${hoverForbiddenCell ? 'omok-room__canvas--forbidden' : ''}`}
              onClick={handleCanvasClick}
              onMouseLeave={handleCanvasMouseLeave}
              onMouseMove={handleCanvasMouseMove}
              ref={canvasRef}
            />
            <canvas className="omok-room__hover-canvas" ref={hoverCanvasRef} />
          </div>

          {moveError && <p className="omok-room__move-error">{moveError}</p>}

          <div className="omok-room__actions">
            {canResign && confirmingResign ? (
              <span className="rummy__confirm" role="alertdialog" aria-label="기권 확인">
                정말 기권할까요? 상대의 승리로 기록돼요.
                <button
                  className="rummy__btn rummy__btn--danger"
                  disabled={resigning}
                  onClick={handleResign}
                  type="button"
                >
                  {resigning ? '처리 중...' : '기권'}
                </button>
                <button
                  className="rummy__btn rummy__btn--ghost"
                  disabled={resigning}
                  onClick={() => setConfirmingResign(false)}
                  type="button"
                >
                  취소
                </button>
              </span>
            ) : canResign ? (
              <button
                className="omok-room__leave-btn"
                onClick={() => setConfirmingResign(true)}
                type="button"
              >
                기권하기
              </button>
            ) : (
              <button
                className="omok-room__leave-btn"
                disabled={leaving}
                onClick={handleLeaveRoom}
                type="button"
              >
                {leaving ? '나가는 중...' : '게임 나가기'}
              </button>
            )}
            {canRematch && !room.rematchBy && (
              <button
                className="omok-room__restart-btn"
                disabled={rematchPending}
                onClick={() => handleRematch('request')}
                type="button"
              >
                {rematchPending ? '신청하는 중...' : '재대국 신청'}
              </button>
            )}
            {canRematch && rematchRequestedByMe && (
              <button
                className="omok-room__rematch-cancel-btn"
                disabled={rematchPending}
                onClick={() => handleRematch('decline')}
                type="button"
              >
                신청 취소
              </button>
            )}
          </div>

          {canRematch && rematchRequestedByMe && (
            <p className="omok-room__rematch-waiting">
              재대국을 신청했어요. 상대의 수락을 기다리는 중이에요.
            </p>
          )}

          {canRematch && rematchRequestedByOpponent && (
            <div className="omok-room__rematch-offer">
              <span>{rematchRequesterName}님이 재대국을 신청했어요. 흑백을 바꿔서 다시 둡니다.</span>
              <div className="omok-room__rematch-offer-actions">
                <button
                  className="omok-room__restart-btn"
                  disabled={rematchPending}
                  onClick={() => handleRematch('accept')}
                  type="button"
                >
                  {rematchPending ? '시작하는 중...' : '수락'}
                </button>
                <button
                  className="omok-room__rematch-cancel-btn"
                  disabled={rematchPending}
                  onClick={() => handleRematch('decline')}
                  type="button"
                >
                  거절
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="omok-room-page__chat">
        <OmokChat myRole={myColor ?? 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}
