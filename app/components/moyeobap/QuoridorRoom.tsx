'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { cellName, checkWall, formatMove, legalPawnMoves, type Cell, type Wall } from '../../lib/quoridorMatch';
import { END_REASON_LABEL, MAX_TIMEOUT_STRIKES, TURN_GRACE_MS, boardOf, type MoveRecord } from '../../lib/quoridorRoom';
import { goalSideToView, rotationFor, wallFromView, wallReasonLabel, type Side } from '../../lib/quoridorView';
import { useQuoridorRoom } from '../../hooks/useQuoridorRoom';
import { useAuth } from './AuthProvider';
import { Spectators } from './Spectators';
import { GameChat, type GameChatConfig } from './GameChat';
import { QuoridorBoard, SEAT_SHAPES, type WallPointerKind } from './QuoridorBoard';

const CHAT_CONFIG: GameChatConfig<'player' | 'spectator'> = {
  apiBase: '/api/games/quoridor/rooms',
  table: 'quoridor_chat_messages',
  channelPrefix: 'quoridor-chat',
  emojis: true,
  roleLabel: { player: '플레이어', spectator: '관전' },
};

const ARROW: Record<Side, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const CONFLICT_PREFIX = '다른 요청이 먼저';
const TIME_LEFT = '아직 시간이 남아 있어요.';
const TURN_TITLE = '(내 차례) ';

/** 미리보기 벽(화면 좌표)과 그것을 만든 화면 상태. 회전이나 방 상태가 바뀌면 자동으로 버려집니다. */
type Preview = { wall: Wall; key: string };

function moveLabel(record: MoveRecord): string {
  if (record.move === 'pass') return '넘김(둘 수 있는 수 없음)';
  if (record.move === 'timeout') return '시간 초과';
  return record.move;
}

// 쿼리도 온라인 방. 방 상태는 Realtime + 20초 폴링(useQuoridorRoom), 수는 표기 하나만 POST합니다.
export function QuoridorRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { room, error, reconnecting, synchronize, sendAction } = useQuoridorRoom(roomId, currentUser?.id);

  const [inputMode, setInputMode] = useState<'move' | 'wall'>('move');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [hover, setHover] = useState<Wall | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const me = room?.players.find((p) => p.id === currentUser?.id && !p.left) ?? null;
  const isPlayer = Boolean(me);
  const isHost = Boolean(room && currentUser && room.hostId === currentUser.id);
  const started = room ? room.status !== 'waiting' : false;
  const mySeat = started && me && me.seat !== null ? me.seat : null;
  const rotation = room ? rotationFor(room.mode, mySeat) : 0;
  const isMyTurn = Boolean(room && room.status === 'playing' && mySeat !== null && room.turnIndex === mySeat);
  const myWallsLeft = room && mySeat !== null ? (room.wallsLeft[mySeat] ?? 0) : 0;
  const mode = myWallsLeft > 0 ? inputMode : 'move';

  const previewKey = `${rotation}:${room?.status ?? ''}:${room?.startedAt ?? ''}`;
  const previewWall = preview && preview.key === previewKey && mode === 'wall' ? preview.wall : null;
  const board = room && started ? boardOf(room) : null;
  const previewAbs = previewWall ? wallFromView(previewWall, rotation) : null;
  const check = board && previewAbs && mySeat !== null ? checkWall(board, mySeat, previewAbs) : null;
  const reason = check ? wallReasonLabel(check, (seat) => room?.players[seat]?.name ?? `${seat + 1}번`) : null;
  const canConfirm = Boolean(isMyTurn && !busy && check?.ok);
  const moveTargets = board && isMyTurn && !busy && mode === 'move' && mySeat !== null ? legalPawnMoves(board, mySeat) : [];

  // Presence: 접속 중인 사람·관전자(루미 방과 같은 방식)
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [spectators, setSpectators] = useState<string[]>([]);
  const playerIdsKey = room?.players.map((p) => `${p.id}:${p.left}`).join(',') ?? '';
  const hasRoom = Boolean(room);
  useEffect(() => {
    if (!currentUser || !hasRoom) return undefined;
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }
    const role = isPlayer ? 'player' : 'spectator';
    const channel = supabase.channel(`quoridor-presence-${roomId}`, { config: { presence: { key: currentUser.id } } });
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
  }, [roomId, currentUser, playerIdsKey, hasRoom]);

  // 시계
  const roomStatus = room?.status;
  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [roomStatus]);

  const turnStarted = room?.turnStartedAt ? Date.parse(room.turnStartedAt) : null;
  const remainingMs = room && turnStarted !== null ? Math.max(0, room.turnLimitSec * 1000 - (now - turnStarted)) : null;

  // 시간 초과 신고: 나가지 않은 참여자만, 자리 순서대로 0.4초씩 시차를 둡니다.
  // 같은 턴에는 한 번 보내고, 시계 차이로 "아직"이라고 거절되면 3초 뒤 한 번만 다시 보냅니다. 오류는 띄우지 않습니다.
  const reportedRef = useRef<string | null>(null);
  const retriedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || room.status !== 'playing' || mySeat === null || !room.turnStartedAt || turnStarted === null) return undefined;
    if (now - turnStarted < room.turnLimitSec * 1000 + TURN_GRACE_MS + mySeat * 400) return undefined;
    const key = room.turnStartedAt;
    if (reportedRef.current === key) return undefined;
    reportedRef.current = key;
    sendAction('timeout').catch((err) => {
      if (getErrorMessage(err, '') !== TIME_LEFT || retriedRef.current === key) return;
      retriedRef.current = key;
      window.setTimeout(() => {
        if (reportedRef.current === key) reportedRef.current = null;
      }, 3000);
    });
    return undefined;
  }, [room, now, mySeat, turnStarted, sendAction]);

  // 차례 알림: 차례가 실제로 나에게 넘어온 순간에만(첫 로드 제외). 맥북·iOS에는 진동이 없어 탭 제목이 유일한 신호입니다.
  const wasMyTurnRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!room) return;
    const prev = wasMyTurnRef.current;
    wasMyTurnRef.current = isMyTurn;
    if (prev === false && isMyTurn) {
      navigator.vibrate?.(80);
      if (document.visibilityState === 'hidden' && !document.title.startsWith(TURN_TITLE)) document.title = TURN_TITLE + document.title;
    }
  }, [room, isMyTurn]);
  useEffect(() => {
    const restore = () => {
      if (document.visibilityState === 'visible' && document.title.startsWith(TURN_TITLE)) document.title = document.title.slice(TURN_TITLE.length);
    };
    document.addEventListener('visibilitychange', restore);
    return () => {
      document.removeEventListener('visibilitychange', restore);
      restore();
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function act(action: Parameters<typeof sendAction>[0], body?: Record<string, unknown>, fallback = '처리하지 못했어요.') {
    setBusy(true);
    try {
      await sendAction(action, body);
      setMessage(null);
      return true;
    } catch (err) {
      const text = getErrorMessage(err, fallback);
      // 다른 사람의 요청이 먼저 처리된 경우는 오류가 아니라 최신 판을 다시 받으면 됩니다.
      if (!text.startsWith(CONFLICT_PREFIX)) setMessage(text);
      await synchronize().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmWall() {
    if (!previewAbs || !canConfirm) return;
    const ok = await act('turn', { move: formatMove({ kind: 'wall', wall: previewAbs }) }, '벽을 놓지 못했어요.');
    if (ok) {
      setPreview(null);
      setHover(null);
      setInputMode('move');
    }
  }

  function rotatePreview() {
    setPreview((p) => (p && p.key === previewKey ? { ...p, wall: { ...p.wall, o: p.wall.o === 'h' ? 'v' : 'h' } } : p));
  }

  function onWallPointer(kind: WallPointerKind, point: { r: number; c: number }) {
    if (kind === 'leave') {
      setHover(null);
      return;
    }
    if (kind === 'hover') {
      setHover({ ...point, o: previewWall?.o ?? 'h' });
      return;
    }
    if (kind === 'down' && previewWall && previewWall.r === point.r && previewWall.c === point.c) {
      rotatePreview(); // 같은 교차점을 다시 누르면 가로·세로 전환
      return;
    }
    setPreview({ wall: { ...point, o: previewWall?.o ?? 'h' }, key: previewKey });
  }

  // 키보드: R 회전, Enter 확정, Esc 취소(벽 모드에서만). 최신 핸들러는 ref로 넘겨 리스너를 한 번만 겁니다.
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keyHandlerRef.current = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'r' || event.key === 'R') rotatePreview();
      else if (event.key === 'Enter') void confirmWall();
      else if (event.key === 'Escape') setPreview(null);
    };
  });
  useEffect(() => {
    if (mode !== 'wall') return undefined;
    const onKey = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  async function leave(path: string) {
    setBusy(true);
    try {
      await requestJson(`/api/games/quoridor/rooms/${roomId}/leave`, { method: 'POST' });
      router.push(path);
    } catch (err) {
      setMessage(getErrorMessage(err, '나가지 못했어요.'));
      setBusy(false);
    }
  }

  if (error && !room) return <div className="omok-room__state">방을 불러오지 못했어요.</div>;
  if (!room) return <div className="omok-room__state">불러오는 중...</div>;

  const staying = room.players.filter((p) => !p.left);
  const current = room.players[room.turnIndex];
  const winner = room.winnerId ? room.players.find((p) => p.id === room.winnerId) : null;
  const hasOpenSeat = room.status === 'waiting' && staying.length < room.mode;
  const remainingSec = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const lastMove = room.moves.at(-1);
  const notice = room.status === 'playing' && lastMove && (lastMove.move === 'pass' || lastMove.move === 'timeout')
    ? lastMove.move === 'pass'
      ? `${room.players[lastMove.seat]?.name}: 둘 수 있는 수가 없어 넘김`
      : `${room.players[lastMove.seat]?.name}: 시간 초과 ${room.players[lastMove.seat]?.timeouts ?? 0}/${MAX_TIMEOUT_STRIKES}`
    : null;

  let statusText: string;
  if (room.status === 'waiting') {
    statusText = isHost
      ? staying.length === room.mode
        ? '모두 모였어요. 시작을 눌러주세요.'
        : `${room.mode}명이 모이길 기다리는 중이에요 (${staying.length}/${room.mode}).`
      : isPlayer
        ? '방장이 시작하길 기다리는 중이에요.'
        : hasOpenSeat
          ? '관전 중이에요. 자리가 남아 있으니 앉아서 함께 할 수도 있어요.'
          : '관전 중이에요 (자리가 다 찼어요).';
  } else if (room.status === 'finished') {
    statusText = winner ? `🏁 ${winner.name} 승리 — ${room.endReason ? END_REASON_LABEL[room.endReason] : ''}` : '게임이 끝났어요.';
  } else if (isMyTurn) {
    statusText = mode === 'wall' ? '🟢 내 차례 — 벽 놓을 자리를 고르고 확정하세요.' : '🟢 내 차례 — 점 찍힌 칸으로 움직이거나 벽을 세우세요.';
  } else {
    statusText = `${current?.name ?? '…'} 차례예요.`;
  }

  return (
    <div className="omok-room-page__layout">
      <div className="omok-room-page__main">
        <div className="rummy rummy--room quoridor-room">
          <div className="omok-room__header">
            <h2 className="omok-room__name">{room.roomName}</h2>
            <span className="chess-room__tc">
              {room.mode}인전 · ⏱ 턴당 {room.turnLimitSec}초
            </span>
            <Spectators names={spectators} />
          </div>

          {reconnecting && <p className="quoridor-room__notice">연결이 불안정해요. 다시 연결하는 중…</p>}

          {room.status === 'waiting' ? (
            <div className="rummy__players">
              {room.players.map((p) => (
                <span className="rummy__player" key={p.id}>
                  {onlineIds.has(p.id) ? '🟢' : '⚪'} {p.name}
                  {p.id === room.hostId ? ' 👑' : ''}
                  {isHost && p.id !== room.hostId && (
                    <button
                      aria-label={`${p.name} 내보내기`}
                      className="rummy__kick"
                      disabled={busy}
                      onClick={() => act('kick', { userId: p.id }, '내보내지 못했어요.')}
                      title="내보내기 (자리를 비운 사람을 정리할 때)"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              <span className="rummy__deck">
                {staying.length} / {room.mode}명
              </span>
            </div>
          ) : (
            <div className="quoridor-room__chips">
              {room.players.map((p, seat) => {
                const active = room.status === 'playing' && room.turnIndex === seat && !p.left;
                return (
                  <div
                    className={`quoridor-room__chip quoridor-room__chip--seat${seat} ${active ? 'quoridor-room__chip--active' : ''} ${p.left ? 'quoridor-room__chip--left' : ''} ${room.winnerId === p.id ? 'quoridor-room__chip--winner' : ''}`}
                    key={p.id}
                  >
                    <span className="quoridor-room__chip-shape" aria-hidden="true">{SEAT_SHAPES[seat]}</span>
                    <span className="quoridor-room__chip-name">
                      {onlineIds.has(p.id) ? '' : '⚪ '}
                      {p.name}
                      {p.id === currentUser?.id ? ' (나)' : ''}
                    </span>
                    <span className="quoridor-room__chip-meta">
                      {p.left ? '나감' : `벽 ${room.wallsLeft[seat] ?? 0} · ${ARROW[goalSideToView(room.mode, seat, rotation)]}`}
                      {!p.left && p.timeouts > 0 ? ` · ⏰${p.timeouts}/${MAX_TIMEOUT_STRIKES}` : ''}
                      {active && mySeat !== null && remainingSec !== null ? ` · ${remainingSec}초` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className={`rummy__status ${room.status === 'finished' ? 'rummy__status--over' : ''}`}>
            {statusText}
            {room.status === 'playing' && mySeat !== null && remainingSec !== null && (
              <span className={`chess-room__clock ${remainingSec <= 10 ? 'chess-room__clock--urgent' : ''}`}>⏱ {remainingSec}초</span>
            )}
          </p>
          {room.status === 'playing' && mySeat === null && (
            <p className="quoridor-room__notice">관전 화면은 최대 20초 늦을 수 있어요.</p>
          )}
          {notice && <p className="quoridor-room__notice">{notice}</p>}

          {room.status === 'waiting' ? (
            <div className="rummy__waiting">
              <p>초대 링크를 친구에게 보내세요. 같은 링크로 들어와 &quot;자리 앉기&quot;를 누르면 돼요.</p>
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
                  <button className="rummy__btn" disabled={busy || staying.length !== room.mode} onClick={() => act('start')} type="button">
                    게임 시작 ({staying.length}/{room.mode})
                  </button>
                )}
                {!isPlayer && currentUser && hasOpenSeat && (
                  <button className="rummy__btn" disabled={busy} onClick={() => act('join', undefined, '자리에 앉지 못했어요.')} type="button">
                    자리 앉기 ({staying.length} / {room.mode})
                  </button>
                )}
                <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => leave('/games/quoridor')} type="button">
                  {isPlayer ? '나가기' : '로비로'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <QuoridorBoard
                hover={mode === 'wall' && isPlayer ? hover : null}
                inputMode={isPlayer && room.status === 'playing' ? mode : 'move'}
                moveTargets={moveTargets}
                onMove={(cell: Cell) => act('turn', { move: cellName(cell) }, '움직이지 못했어요.')}
                onWallPointer={onWallPointer}
                preview={previewWall}
                previewInvalid={Boolean(check && !check.ok)}
                room={room}
                rotation={rotation}
              />

              {isPlayer && room.status === 'playing' && (
                <div className="quoridor-room__controls">
                  <div className="quoridor-room__toggle" role="group" aria-label="조작 모드">
                    <button className={`rummy__chip ${mode === 'move' ? 'rummy__chip--active' : ''}`} onClick={() => setInputMode('move')} type="button">
                      이동
                    </button>
                    <button
                      className={`rummy__chip ${mode === 'wall' ? 'rummy__chip--active' : ''}`}
                      disabled={myWallsLeft === 0}
                      onClick={() => setInputMode('wall')}
                      type="button"
                    >
                      벽 ({myWallsLeft})
                    </button>
                  </div>
                  {mode === 'wall' && (
                    <>
                      <p className={`quoridor-room__reason ${reason ? 'quoridor-room__reason--bad' : ''}`}>
                        {reason ?? (previewWall ? (isMyTurn ? '이 자리에 놓을 수 있어요.' : '내 차례가 오면 확정할 수 있어요.') : '보드를 눌러 벽 놓을 자리를 고르세요. 같은 자리를 다시 누르면 방향이 바뀌어요.')}
                      </p>
                      <div className="rummy__actions">
                        <button className="rummy__btn" disabled={!canConfirm} onClick={() => void confirmWall()} type="button">
                          확정
                        </button>
                        <button className="rummy__btn rummy__btn--ghost" disabled={!previewWall} onClick={rotatePreview} type="button" title="R">
                          회전
                        </button>
                        <button className="rummy__btn rummy__btn--ghost" disabled={!previewWall} onClick={() => setPreview(null)} type="button" title="Esc">
                          취소
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="rummy__actions">
                {room.status === 'finished' && (
                  <Link className="rummy__btn rummy__btn--ghost" href="/games/quoridor/ranking">
                    🏆 랭킹 보기
                  </Link>
                )}
                {room.status === 'finished' && isHost && (
                  <button className="rummy__btn" disabled={busy} onClick={() => act('restart')} type="button">
                    {staying.length === room.mode ? '같은 멤버로 다시 하기' : '다시 모집하기'}
                  </button>
                )}
                {room.status === 'playing' && isPlayer && confirmingResign ? (
                  <span className="rummy__confirm" role="alertdialog" aria-label="기권 확인">
                    기권하면 이 판에서 지고 로비로 나가요.
                    <button className="rummy__btn rummy__btn--danger" disabled={busy} onClick={() => leave('/games/quoridor')} type="button">
                      기권
                    </button>
                    <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => setConfirmingResign(false)} type="button">
                      취소
                    </button>
                  </span>
                ) : room.status === 'playing' && isPlayer ? (
                  <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => setConfirmingResign(true)} type="button">
                    기권하기
                  </button>
                ) : (
                  <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => (isPlayer ? leave('/games/quoridor') : router.push('/games/quoridor'))} type="button">
                    {isPlayer ? '나가기' : '로비로'}
                  </button>
                )}
              </div>

              {room.moves.length > 0 && (
                <details className="quoridor-room__log">
                  <summary>기보 ({room.moves.length}수)</summary>
                  <ol>
                    {room.moves.map((m, i) => (
                      <li key={i}>
                        {SEAT_SHAPES[m.seat]} {room.players[m.seat]?.name}: {moveLabel(m)}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
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

