'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { INITIAL_MELD, type Tile } from '../../lib/rummy';
import { END_REASON_LABEL, MAX_PLAYERS, MAX_TIMEOUT_STRIKES, MIN_PLAYERS, TURN_GRACE_MS, type EndReason, type RoomPlayer, type RoomStatus } from '../../lib/rummyMatch';
import { useAuth } from './AuthProvider';
import { Spectators } from './Spectators';
import { GameChat, type GameChatConfig } from './GameChat';
import { RummyBoard, applyMove, type MoveTarget, type Selection } from './RummyBoard';

type RoomData = {
  id: string;
  roomName: string;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
  turnIndex: number;
  table: Tile[][];
  deckCount: number;
  passStreak: number;
  winnerId: string | null;
  endReason: EndReason;
  turnLimitSec: number;
  version: number;
  turnStartedAt: string | null;
};

const CHAT_CONFIG: GameChatConfig<'player' | 'spectator'> = {
  apiBase: '/api/games/rummy/rooms',
  table: 'rummy_chat_messages',
  channelPrefix: 'rummy-chat',
  roleLabel: { player: '플레이어', spectator: '관전' },
};

type Draft = { version: number; table: Tile[][]; hand: Tile[] };

// 루미큐브 온라인 방. 방 상태는 2초 폴링 + Realtime, 내 손패는 API로만 받습니다.
// 내 차례에 타일을 옮기는 동안은 화면의 "초안(draft)"만 바뀌고, 턴 종료 때 최종 테이블을 서버로 보냅니다.
export function RummyRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { data, error, mutate } = useSWR<{ room: RoomData; myHand: Tile[] | null }>(`/api/games/rummy/rooms/${roomId}`, fetcher, {
    refreshInterval: 2000,
  });
  const room = data?.room;
  const serverHand = useMemo(() => data?.myHand ?? [], [data?.myHand]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [sortBy, setSortBy] = useState<'color' | 'num'>('color');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }
    const channel = supabase
      .channel(`rummy-room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rummy_rooms', filter: `id=eq.${roomId}` }, () => mutate())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  const me = room?.players.find((p) => p.id === currentUser?.id && !p.left) ?? null;
  const isPlayer = Boolean(me);
  const isHost = Boolean(room && currentUser && room.hostId === currentUser.id);
  const current = room ? room.players[room.turnIndex] : null;
  const isMyTurn = Boolean(room && room.status === 'playing' && me && current?.id === me.id);

  // 내 차례이고 서버 버전이 그대로일 때만 초안을 씁니다. 서버가 바뀌면(내 턴이 끝나거나 누가 나가면) 초안은 버립니다.
  const useDraft = Boolean(room && isMyTurn && draft && draft.version === room.version);
  const roomTable = room?.table;
  const table = useMemo(() => (useDraft && draft ? draft.table : (roomTable ?? [])), [useDraft, draft, roomTable]);
  const hand = useDraft && draft ? draft.hand : serverHand;

  const placedIds = useMemo(() => new Set(serverHand.map((t) => t.id)), [serverHand]);
  const placedThisTurn = useMemo(() => table.flat().filter((t) => placedIds.has(t.id)).length, [table, placedIds]);
  const canDropToHand = selection.length > 0 && selection.every((s) => s.from === 'hand' || placedIds.has(s.id));

  // Presence: 접속 중인 사람·관전자
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [spectators, setSpectators] = useState<string[]>([]);
  const playerIdsKey = room?.players.map((p) => p.id).join(',') ?? '';
  useEffect(() => {
    if (!currentUser || !room) return undefined;
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }
    const role = room.players.some((p) => p.id === currentUser.id && !p.left) ? 'player' : 'spectator';
    const channel = supabase.channel(`rummy-presence-${roomId}`, { config: { presence: { key: currentUser.id } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ userId: string; name: string; role: string }>();
      const ids = new Set<string>();
      const names: string[] = [];
      Object.values(state).forEach((metas) =>
        metas.forEach((m) => {
          ids.add(m.userId);
          if (m.role === 'spectator' && !names.includes(m.name)) names.push(m.name);
        }),
      );
      setOnlineIds(ids);
      setSpectators(names);
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ userId: currentUser.id, name: currentUser.name, role });
    });
    return () => {
      supabase.removeChannel(channel);
    };
    // 참여자 구성이 바뀔 때만 재구독합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser, playerIdsKey]);

  // 시계
  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [roomStatus]);

  const turnStarted = room?.turnStartedAt ? Date.parse(room.turnStartedAt) : null;
  const remainingMs = room && turnStarted ? Math.max(0, room.turnLimitSec * 1000 - (now - turnStarted)) : null;

  // 시간 초과를 서버에 알립니다(참여자 누구나; 판정은 서버가 다시 함).
  // 전원이 같은 순간에 신고해 요청이 겹치지 않게 자리 순서대로 0.4초씩 시차를 둡니다.
  const reportedRef = useRef<string | null>(null);
  const mySeatIndex = room && currentUser ? Math.max(0, room.players.findIndex((p) => p.id === currentUser.id)) : 0;
  useEffect(() => {
    if (!room || room.status !== 'playing' || !isPlayer || !room.turnStartedAt || turnStarted === null) return undefined;
    if (now - turnStarted < room.turnLimitSec * 1000 + TURN_GRACE_MS + mySeatIndex * 400) return undefined;
    if (reportedRef.current === room.turnStartedAt) return undefined;
    reportedRef.current = room.turnStartedAt;
    requestJson(`/api/games/rummy/rooms/${roomId}/timeout`, { method: 'POST' })
      .then(() => mutate())
      .catch(() => {
        reportedRef.current = null;
      });
    return undefined;
  }, [room, now, isPlayer, roomId, mutate, turnStarted, mySeatIndex]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function toggleSelect(id: string, from: 'hand' | number) {
    if (!isMyTurn) return;
    setSelection((prev) => (prev.some((s) => s.id === id) ? prev.filter((s) => s.id !== id) : [...prev, { id, from }]));
  }

  function moveSelected(target: MoveTarget) {
    if (!room || !isMyTurn || selection.length === 0) return;
    if (target === 'hand' && !canDropToHand) {
      setMessage('원래 테이블에 있던 타일은 손으로 가져올 수 없어요.');
      return;
    }
    const next = applyMove({ hand, table, selection, target });
    setDraft({ version: room.version, table: next.table, hand: next.hand });
    setSelection([]);
  }

  function resetTurn() {
    setDraft(null);
    setSelection([]);
  }

  async function post(path: string, body?: unknown, fallback = '처리하지 못했어요.') {
    setBusy(true);
    try {
      await requestJson(`/api/games/rummy/rooms/${roomId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      setDraft(null);
      setSelection([]);
      setMessage(null);
      await mutate();
    } catch (err) {
      setMessage(getErrorMessage(err, fallback));
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  async function endTurn() {
    if (!room || !isMyTurn) return;
    if (placedThisTurn === 0) {
      await post('draw', undefined, '타일을 뽑지 못했어요.');
      return;
    }
    await post('turn', { table: table.map((set) => set.map((t) => t.id)) }, '턴을 마치지 못했어요.');
  }

  // 게임 중 기권은 브라우저 확인창(confirm) 대신 화면 안에서 한 번 더 묻습니다.
  // (일부 내장 브라우저는 confirm 창을 막아 버튼이 먹지 않는 것처럼 보입니다.)
  const needsResignConfirm = room?.status === 'playing' && isPlayer;
  async function handleLeave() {
    if (needsResignConfirm && !confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    await post('leave');
    router.push('/games/rummy/online');
  }

  if (error) return <div className="omok-room__state">방을 불러오지 못했어요.</div>;
  if (!room) return <div className="omok-room__state">불러오는 중...</div>;

  const remainingSec = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const hasOpenSeat = room.status === 'waiting' && room.players.length < MAX_PLAYERS;
  const winner = room.winnerId ? room.players.find((p) => p.id === room.winnerId) : null;

  let statusText: string;
  if (room.status === 'waiting') {
    statusText = isHost
      ? room.players.length >= MIN_PLAYERS
        ? '모두 모였으면 시작을 눌러주세요.'
        : '친구가 들어오길 기다리는 중이에요 (2명 이상이면 시작 가능).'
      : isPlayer
        ? '방장이 시작하길 기다리는 중이에요.'
        : hasOpenSeat
          ? '관전 중이에요. 자리가 남아 있으니 앉아서 함께 할 수도 있어요.'
          : '관전 중이에요 (자리가 다 찼어요).';
  } else if (room.status === 'finished') {
    statusText = winner ? `🏁 ${winner.name} 승리 — ${room.endReason ? END_REASON_LABEL[room.endReason] : ''}` : '게임이 끝났어요.';
  } else if (isMyTurn) {
    statusText = me?.melded ? '🟢 내 차례 — 타일을 내거나 뽑으세요.' : `🟢 내 차례 — 첫 등록(${INITIAL_MELD}점 이상)을 해보세요.`;
  } else {
    statusText = `${current?.name ?? '…'} 차례예요.`;
  }

  return (
    <div className="omok-room-page__layout">
      <div className="omok-room-page__main">
        <div className="rummy rummy--room">
          <div className="omok-room__header">
            <h2 className="omok-room__name">{room.roomName}</h2>
            <span className="chess-room__tc">⏱ 턴당 {room.turnLimitSec}초</span>
            <Spectators names={spectators} />
          </div>

          <div className="rummy__players">
            {room.players.map((p, i) => (
              <span
                className={`rummy__player ${room.status === 'playing' && room.turnIndex === i ? 'rummy__player--active' : ''} ${room.winnerId === p.id ? 'rummy__player--winner' : ''} ${p.left ? 'rummy__player--left' : ''}`}
                key={p.id}
              >
                {onlineIds.has(p.id) ? '🟢' : '⚪'} {p.name}
                {p.id === room.hostId ? ' 👑' : ''}
                {p.left ? ' · 기권' : room.status === 'playing' ? ` · ${p.tileCount}장${p.melded ? '' : ' · 미등록'}` : ''}
                {room.status === 'playing' && !p.left && (p.timeouts ?? 0) > 0 ? ` · ⏰${p.timeouts}/${MAX_TIMEOUT_STRIKES}` : ''}
                {room.status === 'finished' ? ` · ${(p.score ?? 0) >= 0 ? '+' : ''}${p.score ?? 0}점` : ''}
                {room.status === 'waiting' && isHost && p.id !== room.hostId && (
                  <button
                    aria-label={`${p.name} 내보내기`}
                    className="rummy__kick"
                    disabled={busy}
                    onClick={() => post('kick', { userId: p.id }, '내보내지 못했어요.')}
                    title="내보내기 (자리를 비운 사람을 정리할 때)"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {room.status !== 'waiting' && <span className="rummy__deck">🂠 남은 타일 {room.deckCount}</span>}
            {room.status === 'waiting' && (
              <span className="rummy__deck">
                {room.players.length} / {MAX_PLAYERS}명
              </span>
            )}
          </div>

          <p className={`rummy__status ${room.status === 'finished' ? 'rummy__status--over' : ''}`}>
            {statusText}
            {room.status === 'playing' && remainingSec !== null && (
              <span className={`chess-room__clock ${remainingSec <= 10 ? 'chess-room__clock--urgent' : ''}`}>⏱ {remainingSec}초</span>
            )}
          </p>

          {room.status === 'waiting' ? (
            <div className="rummy__waiting">
              <p>초대 링크를 친구에게 보내세요. 같은 링크로 들어오면 자동으로 자리에 앉아요.</p>
              <div className="rummy__actions">
                <button
                  className="rummy__btn rummy__btn--ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href).then(() => setMessage('초대 링크를 복사했어요.'));
                  }}
                  type="button"
                >
                  초대 링크 복사
                </button>
                {isHost && (
                  <button className="rummy__btn" disabled={busy || room.players.length < MIN_PLAYERS} onClick={() => post('start')} type="button">
                    게임 시작 ({room.players.length}명)
                  </button>
                )}
                {!isPlayer && currentUser && hasOpenSeat && (
                  <button className="rummy__btn" disabled={busy} onClick={() => post('join', undefined, '자리에 앉지 못했어요.')} type="button">
                    자리 앉기 ({room.players.length} / {MAX_PLAYERS})
                  </button>
                )}
                <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={handleLeave} type="button">
                  {isPlayer ? '나가기' : '로비로'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <RummyBoard
                active={isMyTurn}
                canDropToHand={canDropToHand}
                hand={isPlayer ? hand : []}
                handTitle={isPlayer ? '내 타일' : '관전 중'}
                onMove={moveSelected}
                onSortBy={setSortBy}
                onToggleSelect={toggleSelect}
                selection={selection}
                sortBy={sortBy}
                table={table}
              />

              <div className="rummy__actions">
                {isPlayer && room.status === 'playing' && (
                  <>
                    <button className="rummy__btn" disabled={!isMyTurn || busy} onClick={endTurn} type="button">
                      {placedThisTurn > 0 ? '턴 종료' : room.deckCount > 0 ? '타일 뽑고 넘기기' : '넘기기'}
                    </button>
                    <button className="rummy__btn rummy__btn--ghost" disabled={!isMyTurn || !useDraft} onClick={resetTurn} type="button">
                      이번 턴 되돌리기
                    </button>
                    <button className="rummy__btn rummy__btn--ghost" disabled={selection.length === 0} onClick={() => setSelection([])} type="button">
                      선택 해제
                    </button>
                  </>
                )}
                {room.status === 'finished' && isHost && (
                  <button className="rummy__btn" disabled={busy} onClick={() => post('restart')} type="button">
                    같은 멤버로 다시 하기
                  </button>
                )}
                {needsResignConfirm && confirmingLeave ? (
                  <span className="rummy__confirm" role="alertdialog" aria-label="기권 확인">
                    정말 기권할까요? 남은 타일의 벌점만큼 점수를 잃어요.
                    <button className="rummy__btn rummy__btn--danger" disabled={busy} onClick={handleLeave} type="button">
                      기권
                    </button>
                    <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => setConfirmingLeave(false)} type="button">
                      취소
                    </button>
                  </span>
                ) : (
                  <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={handleLeave} type="button">
                    {needsResignConfirm ? '기권하고 나가기' : '나가기'}
                  </button>
                )}
              </div>
            </>
          )}

          {message && <p className="rummy__message">{message}</p>}
        </div>
      </div>

      <div className="omok-room-page__chat">
        <GameChat config={CHAT_CONFIG} myRole={isPlayer ? 'player' : 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}
