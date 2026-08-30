'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { POLLING_PRESETS } from '../../lib/swrConfig';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { TURN_LIMIT_MS, isTurnExpired, remainingTurnMs } from '../../lib/alkkagiMatch';
import type { Shot, Stone } from '../../lib/alkkagiPhysics';
import { useAuth } from './AuthProvider';
import { Spectators } from './Spectators';
import { AlkkagiBoard, type Replay } from './AlkkagiBoard';
import { AlkkagiChat } from './AlkkagiChat';

// app/lib/alkkagi.ts의 AlkkagiRoom과 같은 모양입니다. 서버 전용 모듈(supabase)을
// 'use client' 컴포넌트로 끌어오지 않으려고 여기에 다시 적습니다
// (PongRoom.tsx의 PongRoomData와 같은 방식).
type AlkkagiRoomData = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'finished';
  blackId: string | null;
  blackName: string | null;
  whiteId: string | null;
  whiteName: string | null;
  stones: Stone[];
  preShotStones: Stone[] | null;
  lastShot: Shot | null;
  lastShotAt: string | null;
  shotSeq: number;
  turn: 'black' | 'white';
  winner: 'black' | 'white' | 'draw' | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
};

const DISCONNECT_CLAIM_DELAY_MS = 60_000;

export function AlkkagiRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser, openAuth } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [sitting, setSitting] = useState(false);
  const [shotError, setShotError] = useState<string | null>(null);
  // 남은 시간 표시를 위해 현재 시각을 짧은 간격으로 갱신합니다.
  const [now, setNow] = useState(() => Date.now());
  const { data, error, mutate } = useSWR<{ room: AlkkagiRoomData }>(
    `/api/games/alkkagi/rooms/${roomId}`,
    fetcher,
    POLLING_PRESETS.GAME_ROOM,
  );
  const room = data?.room;

  // 방 상태(배치/턴/승패) 실시간 구독 — 참여자에게는 즉시 반영되고,
  // 관전자는 위 2초 polling으로 따라잡습니다.
  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`alkkagi-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alkkagi_rooms', filter: `id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  const myColor =
    currentUser?.id === room?.blackId ? 'black' : currentUser?.id === room?.whiteId ? 'white' : null;
  const isMyTurn =
    Boolean(room) && myColor !== null && room!.status === 'playing' && room!.turn === myColor;

  // ── 샷 재생 ───────────────────────────────────────────────────────────
  // shot_seq가 오르면 발사 전 배치부터 굴려 보여줍니다. 새로고침했거나 중간에
  // 들어온 관전자는 지난 샷을 재생하지 않습니다 — seq만 맞춰두고 현재 배치부터
  // 봅니다(안 그러면 들어오자마자 남의 샷이 한 번 재생됩니다).
  const seenSeqRef = useRef<number | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);

  useEffect(() => {
    if (!room) return;
    if (seenSeqRef.current === null) {
      seenSeqRef.current = room.shotSeq; // 첫 로드
      return;
    }
    if (room.shotSeq <= seenSeqRef.current) return;
    seenSeqRef.current = room.shotSeq;
    if (!room.preShotStones || !room.lastShot || !room.lastShotAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReplay({
      seq: room.shotSeq,
      pre: room.preShotStones,
      shot: room.lastShot,
      startedAtMs: Date.parse(room.lastShotAt),
    });
  }, [room]);

  function handleReplayEnd(seq: number) {
    setReplay((current) => (current?.seq === seq ? null : current));
  }

  // Presence: 접속 중인 사람 목록(참여자 온라인 여부 + 관전자). 방 전체를
  // 의존성에 두면 2초 polling마다 재구독되므로 자리 주인만 의존성으로 둡니다.
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

    const role =
      currentUser.id === room.blackId
        ? 'black'
        : currentUser.id === room.whiteId
          ? 'white'
          : 'spectator';
    const channel = supabase.channel(`alkkagi-presence-${roomId}`, {
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
  const opponentName =
    myColor === 'black' ? room?.whiteName : myColor === 'white' ? room?.blackName : null;
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

  // 안내 문구는 몇 초 뒤 자동으로 사라집니다.
  useEffect(() => {
    if (!shotError) return undefined;
    const timer = window.setTimeout(() => setShotError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [shotError]);

  // 진행 중에만 시계를 돌립니다.
  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [roomStatus]);

  // 제한 시간이 지나면 서버에 알립니다. 판정은 서버가 turn_started_at으로
  // 다시 하므로 이 호출은 "확인해달라"는 신호일 뿐이고, 양쪽 클라이언트가
  // 같이 호출해도 승부는 한 번만 확정됩니다.
  const reportedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || room.status !== 'playing' || myColor === null) return undefined;
    const turnKey = room.turnStartedAt;
    if (!turnKey || !isTurnExpired(turnKey, now)) return undefined;
    if (reportedTurnRef.current === turnKey) return undefined;

    reportedTurnRef.current = turnKey;
    let retryTimer: number | undefined;
    requestJson(`/api/games/alkkagi/rooms/${roomId}/timeout`, { method: 'POST' })
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

  /**
   * 놓는 즉시 내 화면에서 굴러가기 시작하고, 동시에 서버로 보냅니다. 왕복
   * 지연을 기다렸다 굴러가면 손맛이 완전히 죽습니다. 물리가 결정적이라 서버
   * 결과와 어긋나지 않고, 거절당하면 애니메이션을 접고 현재 배치로 되돌립니다.
   */
  async function handleShoot(shot: Shot) {
    if (!room) return;
    const previousSeq = room.shotSeq;
    const localSeq = previousSeq + 1;
    seenSeqRef.current = localSeq;
    setReplay({ seq: localSeq, pre: room.stones, shot, startedAtMs: Date.now() });
    try {
      const response = await requestJson<{ room: AlkkagiRoomData }>(
        `/api/games/alkkagi/rooms/${roomId}/shoot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shot),
        },
      );
      // 서버가 확정한 배치를 바로 반영합니다. seq가 같으므로 재생은 다시
      // 시작되지 않고, 지금 굴러가는 장면이 끝나면 이 배치로 스냅됩니다.
      await mutate({ room: response.room }, { revalidate: false });
    } catch (err) {
      setReplay(null);
      seenSeqRef.current = previousSeq;
      setShotError(getErrorMessage(err, '샷을 보내지 못했어요.'));
      mutate();
    }
  }

  async function handleLeaveRoom() {
    setLeaving(true);
    try {
      await requestJson(`/api/games/alkkagi/rooms/${roomId}/leave`, { method: 'POST' });
    } catch {
      // 무시하고 로비로 이동합니다.
    }
    router.push('/games/alkkagi');
  }

  // 관전자가 빈 자리에 앉습니다. 대기 중인 방에 들어가는 것과 같은
  // 엔드포인트를 씁니다(서버가 어느 자리가 비었는지 판단합니다).
  async function handleSitDown() {
    if (!currentUser) {
      openAuth(`/games/alkkagi/${roomId}`);
      return;
    }
    setSitting(true);
    setShotError(null);
    try {
      await requestJson(`/api/games/alkkagi/rooms/${roomId}/join`, { method: 'POST' });
      mutate();
    } catch (err) {
      setShotError(getErrorMessage(err, '자리에 앉지 못했어요.'));
    } finally {
      setSitting(false);
    }
  }

  // 기권은 그 판만 내주고 방에는 그대로 남습니다. 확인은 브라우저 confirm
  // 대신 화면 안에서 한 번 더 묻습니다(일부 내장 브라우저가 confirm 창을 막아
  // 버튼이 먹지 않는 것처럼 보입니다).
  async function handleResign() {
    setResigning(true);
    try {
      await requestJson(`/api/games/alkkagi/rooms/${roomId}/resign`, { method: 'POST' });
      setConfirmingResign(false);
      setShotError(null);
    } catch (err) {
      setShotError(getErrorMessage(err, '기권하지 못했어요.'));
    } finally {
      setResigning(false);
      mutate();
    }
  }

  async function handleRematch(action: 'request' | 'accept' | 'decline') {
    setRematchPending(true);
    try {
      await requestJson(`/api/games/alkkagi/rooms/${roomId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch (err) {
      setShotError(getErrorMessage(err, '재대국 요청을 처리하지 못했어요.'));
      mutate();
    } finally {
      setRematchPending(false);
    }
  }

  async function handleClaimWin() {
    setClaiming(true);
    try {
      await requestJson(`/api/games/alkkagi/rooms/${roomId}/claim-win`, { method: 'POST' });
      mutate();
    } catch {
      // 무시
    } finally {
      setClaiming(false);
    }
  }

  if (error) {
    return <div className="alkkagi-room__state">방을 불러오지 못했어요.</div>;
  }
  if (!room) {
    return <div className="alkkagi-room__state">불러오는 중...</div>;
  }

  const blackLabel = room.blackName ?? '빈 자리';
  const whiteLabel = room.whiteName ?? '빈 자리';
  const emptySeat = !room.blackId ? 'black' : !room.whiteId ? 'white' : null;
  const blackLeft = room.stones.filter((stone) => stone.owner === 'black').length;
  const whiteLeft = room.stones.filter((stone) => stone.owner === 'white').length;

  let statusText: string;
  if (room.status === 'waiting') {
    statusText = '상대를 기다리는 중이에요. 로비에 방이 보이니 곧 들어올 거예요.';
  } else if (room.status === 'finished') {
    if (room.winner === 'draw') {
      statusText = '마지막 돌이 같이 떨어졌어요. 무승부예요.';
    } else if (myColor) {
      statusText = room.winner === myColor ? '🎉 승리했어요!' : '아쉽게 패배했어요.';
    } else {
      statusText = `${room.winner === 'black' ? blackLabel : whiteLabel}님 승리`;
    }
  } else if (myColor) {
    statusText = isMyTurn
      ? '🟢 내 차례예요. 돌을 끌어서 놓으세요.'
      : '🔴 상대가 조준 중이에요.';
  } else {
    statusText = `${room.turn === 'black' ? blackLabel : whiteLabel}님 차례예요`;
  }

  if (room.status === 'finished' && emptySeat) {
    statusText += myColor
      ? ' 상대가 나가서 자리가 비었어요. 관전자가 앉으면 다시 할 수 있어요.'
      : ' 빈 자리에 앉으면 이어서 할 수 있어요.';
  }

  // 남은 시간은 내 차례든 상대 차례든 똑같이 보여줍니다. 상대가 얼마나
  // 남았는지 보이지 않으면 갑자기 시간패로 끝난 것처럼 느껴집니다.
  const showClock = room.status === 'playing' && Boolean(room.turnStartedAt);
  const remainingSec = Math.ceil(remainingTurnMs(room.turnStartedAt, now) / 1000);
  const clockUrgent = remainingSec <= 10;

  const isParticipant = myColor !== null;
  const canResign = isParticipant && room.status === 'playing';
  const canRematch =
    room.status === 'finished' && isParticipant && Boolean(room.blackId) && Boolean(room.whiteId);
  const rematchRequestedByMe = Boolean(room.rematchBy) && room.rematchBy === currentUser?.id;
  const rematchRequestedByOpponent = Boolean(room.rematchBy) && room.rematchBy !== currentUser?.id;
  const rematchRequesterName = room.rematchBy === room.blackId ? blackLabel : whiteLabel;

  return (
    <div className="alkkagi-room-page__layout">
      <div className="alkkagi-room-page__main">
        <div className="alkkagi-room">
          <div className="alkkagi-room__header">
            <h2 className="alkkagi-room__name">{room.roomName}</h2>
            <Spectators names={spectators} />
          </div>

          <div className="alkkagi-room__players">
            <span
              className={`alkkagi-room__player alkkagi-room__player--black ${room.turn === 'black' && room.status === 'playing' ? 'alkkagi-room__player--active' : ''}`}
            >
              ⚫ {blackLabel}
            </span>
            <span className="alkkagi-room__vs">vs</span>
            <span
              className={`alkkagi-room__player alkkagi-room__player--white ${room.turn === 'white' && room.status === 'playing' ? 'alkkagi-room__player--active' : ''}`}
            >
              ⚪ {room.status === 'waiting' ? (room.whiteName ?? '(대기 중)') : whiteLabel}
            </span>
          </div>

          <p className="alkkagi-room__count">
            남은 돌 ⚫ {blackLeft} — {whiteLeft} ⚪
          </p>

          <p className="alkkagi-room__status">{statusText}</p>

          {showClock && (
            <p className={`alkkagi-room__clock ${clockUrgent ? 'alkkagi-room__clock--urgent' : ''}`}>
              ⏱ {String(Math.floor(remainingSec / 60)).padStart(2, '0')}:
              {String(remainingSec % 60).padStart(2, '0')}
              <span className="alkkagi-room__clock-note">
                한 턴 {Math.round(TURN_LIMIT_MS / 1000)}초
              </span>
            </p>
          )}

          {showDisconnectBanner && (
            <div className="alkkagi-room__disconnect-banner">
              <span>⚠️ {opponentName}님의 연결이 끊어졌습니다. 재접속을 기다리는 중이에요.</span>
              {claimAvailable && (
                <button disabled={claiming} onClick={handleClaimWin} type="button">
                  {claiming ? '처리 중...' : '몰수승 처리'}
                </button>
              )}
            </div>
          )}

          <AlkkagiBoard
            canShoot={isMyTurn && replay === null}
            myColor={myColor}
            onReplayEnd={handleReplayEnd}
            onShoot={handleShoot}
            replay={replay}
            stones={room.stones}
            viewAs={myColor ?? 'black'}
          />

          {shotError && <p className="alkkagi-room__shot-error">{shotError}</p>}

          <div className="alkkagi-room__actions">
            {emptySeat && !myColor && (
              <button
                className="alkkagi-room__restart-btn"
                disabled={sitting}
                onClick={handleSitDown}
                type="button"
              >
                {sitting ? '앉는 중...' : `${emptySeat === 'black' ? '⚫ 흑' : '⚪ 백'} 빈 자리에 앉기`}
              </button>
            )}
            {canResign && confirmingResign ? (
              <span aria-label="기권 확인" className="rummy__confirm" role="alertdialog">
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
                className="alkkagi-room__leave-btn"
                onClick={() => setConfirmingResign(true)}
                type="button"
              >
                기권하기
              </button>
            ) : (
              <button
                className="alkkagi-room__leave-btn"
                disabled={leaving}
                onClick={handleLeaveRoom}
                type="button"
              >
                {leaving ? '나가는 중...' : '게임 나가기'}
              </button>
            )}
            {canRematch && !room.rematchBy && (
              <button
                className="alkkagi-room__restart-btn"
                disabled={rematchPending}
                onClick={() => handleRematch('request')}
                type="button"
              >
                {rematchPending ? '신청하는 중...' : '다시 하기 신청'}
              </button>
            )}
            {canRematch && rematchRequestedByMe && (
              <button
                className="alkkagi-room__rematch-cancel-btn"
                disabled={rematchPending}
                onClick={() => handleRematch('decline')}
                type="button"
              >
                신청 취소
              </button>
            )}
          </div>

          {canRematch && rematchRequestedByMe && (
            <p className="alkkagi-room__rematch-waiting">
              다시 하기를 신청했어요. 상대의 수락을 기다리는 중이에요.
            </p>
          )}

          {canRematch && rematchRequestedByOpponent && (
            <div className="alkkagi-room__rematch-offer">
              <span>{rematchRequesterName}님이 다시 하기를 신청했어요. 흑백을 바꿔서 다시 합니다.</span>
              <div className="alkkagi-room__rematch-offer-actions">
                <button
                  className="alkkagi-room__restart-btn"
                  disabled={rematchPending}
                  onClick={() => handleRematch('accept')}
                  type="button"
                >
                  {rematchPending ? '시작하는 중...' : '수락'}
                </button>
                <button
                  className="alkkagi-room__rematch-cancel-btn"
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

      <div className="alkkagi-room-page__chat">
        <AlkkagiChat myRole={myColor ?? 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}
