'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  MAX_PLAYERS,
  MAX_TEXT_LENGTH,
  MIN_PLAYERS,
  PROMPT_IDEAS,
  RECOMMENDED_PLAYERS,
  TURN_GRACE_MS,
  activePlayers,
  turnLimitSec,
  type AlbumEntry,
  type PhoneRoom as Room,
  type RoomPlayer,
} from '../../lib/phoneMatch';
import type { AlbumSummary, PlayerTask } from '../../lib/phoneOnline';
import { useAuth } from './AuthProvider';
import { Spectators } from './Spectators';
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas';
import { GameChat, type GameChatConfig } from './GameChat';

const CHAT_CONFIG: GameChatConfig<'player' | 'spectator'> = {
  apiBase: '/api/games/phone/rooms',
  table: 'phone_chat_messages',
  channelPrefix: 'phone-chat',
  emojis: true,
  roleLabel: { player: '플레이어', spectator: '구경' },
};

function Avatar({ player, size = 22 }: { player: Pick<RoomPlayer, 'name' | 'avatarUrl'>; size?: number }) {
  if (player.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className="phone__avatar" height={size} referrerPolicy="no-referrer" src={player.avatarUrl} width={size} />;
  }
  return (
    <span className="phone__avatar phone__avatar--initial" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {player.name.charAt(0)}
    </span>
  );
}

function entryPlaceholder(entry: AlbumEntry): string {
  if (entry.status === 'left') return '(자리 비움)';
  if (entry.kind === 'draw') return '(시간이 끝나 빈 그림)';
  return '(시간이 끝나 빈 문장)';
}

// 갈틱폰 방. 대기 → 턴 진행(전원 동시, 전원 제출 또는 마감에 다음 턴) → 앨범 공개(방장 조작에 전원 동기화).
export function PhoneRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { data, error, mutate } = useSWR<{ room: Room; albums: AlbumSummary[] }>(`/api/games/phone/rooms/${roomId}`, fetcher, {
    refreshInterval: 8000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });
  const room = data?.room;
  const albums = data?.albums ?? [];

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // 방 변경 Realtime
  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }
    const channel = supabase
      .channel(`phone-room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'phone_rooms', filter: `id=eq.${roomId}` }, () => mutate())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  // Presence: 접속 표시 + 관전자(자리에 앉지 않은 접속자) 이름
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
    const myRole = room.players.some((p) => p.id === currentUser.id && !p.left) ? 'player' : 'spectator';
    const channel = supabase.channel(`phone-presence-${roomId}`, { config: { presence: { key: currentUser.id } } });
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
      if (status === 'SUBSCRIBED') await channel.track({ userId: currentUser.id, name: currentUser.name, role: myRole });
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

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const me = room?.players.find((p) => p.id === currentUser?.id && !p.left) ?? null;
  const isPlayer = Boolean(me);
  const isHost = Boolean(room && currentUser && room.hostId === currentUser.id);
  const isSeated = Boolean(room?.players.some((p) => p.id === currentUser?.id));

  async function post(path: string, body?: unknown, fallback = '처리하지 못했어요.') {
    setBusy(true);
    try {
      await requestJson(`/api/games/phone/rooms/${roomId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      setMessage(null);
      await mutate();
      return true;
    } catch (err) {
      setMessage(getErrorMessage(err, fallback));
      await mutate();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (await post('close', undefined, '방을 없애지 못했어요.')) {
      router.push('/games/phone');
    }
  }

  const needsLeaveConfirm = room?.status === 'playing' && isPlayer;
  async function handleLeave() {
    if (needsLeaveConfirm && !confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    await post('leave');
    router.push('/games/phone');
  }

  if (error) return <div className="omok-room__state">방을 불러오지 못했어요.</div>;
  if (!room) return <div className="omok-room__state">불러오는 중...</div>;

  const active = activePlayers(room);
  const hasOpenSeat = room.status === 'waiting' && room.players.length < MAX_PLAYERS;

  const header = (
    <div className="omok-room__header">
      <h2 className="omok-room__name">{room.roomName}</h2>
      <span className="chess-room__tc">⏱ 글 {room.settings.writeSec}초 · 그림 {room.settings.drawSec}초</span>
      <Spectators names={spectators} />
    </div>
  );

  const playerChips = (
    <div className="rummy__players">
      {room.players.map((p) => (
        <span className={`rummy__player ${p.left ? 'rummy__player--left' : ''} ${room.status === 'playing' && room.submitted.includes(p.id) ? 'phone__player--done' : ''}`} key={p.id}>
          <Avatar player={p} size={18} /> {onlineIds.has(p.id) ? '🟢' : '⚪'} {p.name}
          {p.id === room.hostId ? ' 👑' : ''}
          {p.left ? ' · 자리 비움' : room.status === 'playing' ? (room.submitted.includes(p.id) ? ' · 완료' : ' · 작업 중') : ''}
          {room.status === 'waiting' && isHost && p.id !== room.hostId && (
            <button aria-label={`${p.name} 내보내기`} className="rummy__kick" disabled={busy} onClick={() => post('kick', { userId: p.id }, '내보내지 못했어요.')} title="내보내기" type="button">
              ✕
            </button>
          )}
        </span>
      ))}
      {room.status === 'waiting' && (
        <span className="rummy__deck">
          {room.players.length} / {MAX_PLAYERS}명
        </span>
      )}
    </div>
  );

  const closeControl = !isHost ? null : confirmingClose ? (
    <span className="rummy__confirm" role="alertdialog" aria-label="방 없애기 확인">
      방을 없앨까요? 모두에게서 바로 사라지고 되돌릴 수 없어요.
      <button className="rummy__btn rummy__btn--danger" disabled={busy} onClick={handleClose} type="button">
        방 없애기
      </button>
      <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => setConfirmingClose(false)} type="button">
        취소
      </button>
    </span>
  ) : (
    <button className="rummy__btn rummy__btn--ghost phone__close-btn" disabled={busy} onClick={() => setConfirmingClose(true)} title="방장만 할 수 있어요" type="button">
      🗑 방 없애기
    </button>
  );

  const leaveControl =
    needsLeaveConfirm && confirmingLeave ? (
      <span className="rummy__confirm" role="alertdialog" aria-label="나가기 확인">
        지금 나가면 남은 칸은 ‘자리 비움’으로 남아요. 나갈까요?
        <button className="rummy__btn rummy__btn--danger" disabled={busy} onClick={handleLeave} type="button">
          나가기
        </button>
        <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={() => setConfirmingLeave(false)} type="button">
          취소
        </button>
      </span>
    ) : (
      <button className="rummy__btn rummy__btn--ghost" disabled={busy} onClick={handleLeave} type="button">
        {isSeated ? '나가기' : '로비로'}
      </button>
    );

  // ---------- 대기 ----------
  if (room.status === 'waiting') {
    const statusText = isHost
      ? room.players.length >= MIN_PLAYERS
        ? `모두 모였으면 시작을 눌러주세요. (${RECOMMENDED_PLAYERS}명 이상이면 더 재밌어요)`
        : `친구가 들어오길 기다리는 중이에요 (${MIN_PLAYERS}명 이상이면 시작 가능, ${RECOMMENDED_PLAYERS}명 이상 권장).`
      : isPlayer
        ? '방장이 시작하길 기다리는 중이에요.'
        : hasOpenSeat
          ? '아직 시작 전이에요. 자리에 앉으면 같이 할 수 있어요.'
          : '자리가 다 찼어요.';
    return (
      <div className="omok-room-page__layout">
        <div className="omok-room-page__main">
          <div className="rummy rummy--room phone">
            {header}
            {playerChips}
            <p className="rummy__status">{statusText}</p>
            <div className="rummy__waiting">
              <p>초대 링크를 친구에게 보내세요. 같은 링크로 들어오면 자동으로 자리에 앉아요. 모두가 동시에 글을 쓰고 그림을 그리니 다 모인 뒤 시작하세요.</p>
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
                {leaveControl}
                {closeControl}
              </div>
            </div>
            {message && <p className="rummy__message">{message}</p>}
          </div>
        </div>
        <div className="omok-room-page__chat">
          <GameChat config={CHAT_CONFIG} myRole={isPlayer ? 'player' : 'spectator'} roomId={roomId} />
        </div>
      </div>
    );
  }

  // ---------- 진행 ----------
  if (room.status === 'playing') {
    return (
      <div className="omok-room-page__layout phone-layout--playing">
        <div className="omok-room-page__main">
          <div className="rummy rummy--room phone">
            {header}
            {playerChips}
            {isPlayer ? (
              <TurnWorkspace key={`${room.id}-${room.turn}`} now={now} onMessage={setMessage} onRefresh={mutate} room={room} />
            ) : (
              <p className="rummy__status">게임이 진행 중이에요. 이 판이 끝나면 함께 앨범을 볼 수 있고, 다음 판부터 참여할 수 있어요.</p>
            )}
            <div className="rummy__actions">
              {leaveControl}
              {closeControl}
            </div>
            {message && <p className="rummy__message">{message}</p>}
          </div>
        </div>
        <aside className="phone__chat-note">💬 채팅은 작업 중엔 접어 둬요. 앨범을 볼 때 다시 열려요.</aside>
      </div>
    );
  }

  // ---------- 앨범 공개 ----------
  return (
    <div className="omok-room-page__layout">
      <div className="omok-room-page__main">
        <div className="rummy rummy--room phone">
          {header}
          {playerChips}
          <AlbumViewer albums={albums} busy={busy} isHost={isHost} onPost={post} room={room} />
          <div className="rummy__actions">
            {isHost && (
              <button className="rummy__btn" disabled={busy || active.length < 1} onClick={() => post('restart')} type="button">
                같은 멤버로 한 판 더
              </button>
            )}
            {leaveControl}
            {closeControl}
          </div>
          {message && <p className="rummy__message">{message}</p>}
        </div>
      </div>
      <div className="omok-room-page__chat">
        <GameChat config={CHAT_CONFIG} myRole={isPlayer ? 'player' : 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}

// ---------- 턴 작업 화면 ----------

function TurnWorkspace({ room, now, onMessage, onRefresh }: { room: Room; now: number; onMessage: (m: string | null) => void; onRefresh: () => Promise<unknown>; }) {
  const { data: taskData, mutate: mutateTask } = useSWR<{ task: PlayerTask | null }>(`/api/games/phone/rooms/${room.id}/task?turn=${room.turn}`, fetcher, {
    revalidateOnFocus: false,
  });
  const task = taskData?.task ?? null;
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(true);
  const [sending, setSending] = useState(false);
  const submittedRef = useRef(false);
  const reportedRef = useRef<string | null>(null);

  const limitSec = turnLimitSec(room.settings, room.turn);
  const started = room.turnStartedAt ? Date.parse(room.turnStartedAt) : null;
  const remainingMs = started === null ? null : Math.max(0, limitSec * 1000 - (now - started));
  const remainingSec = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const doneCount = room.submitted.length;
  const total = activePlayers(room).length;

  async function submit(auto = false) {
    if (!task || sending) return false;
    setSending(true);
    try {
      const body = task.kind === 'text' ? { text: text.trim() } : { image: canvasRef.current?.toDataURL() ?? '' };
      if (task.kind === 'text' && !body.text) {
        // 시간이 끝났는데 빈칸이면 서버가 "시간 초과" 칸으로 채우게 둡니다.
        if (!auto) onMessage('문장을 입력해주세요.');
        return false;
      }
      await requestJson(`/api/games/phone/rooms/${room.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      submittedRef.current = true;
      setEditing(false);
      onMessage(null);
      await Promise.all([mutateTask(), onRefresh()]);
      return true;
    } catch (err) {
      onMessage(getErrorMessage(err, '제출하지 못했어요.'));
      return false;
    } finally {
      setSending(false);
    }
  }

  // 시간이 끝나면 손에 든 것을 그대로 자동 제출하고, 유예가 지나면 서버에 마감을 알립니다(시계 tick마다 확인).
  const expiredAt = started === null ? null : started + limitSec * 1000;
  const taskSubmitted = task?.submitted ?? true;
  const turnStartedAt = room.turnStartedAt;
  useEffect(() => {
    if (expiredAt === null || !task) return undefined;
    const graceAt = expiredAt + TURN_GRACE_MS;
    if (!taskSubmitted && !submittedRef.current && now >= expiredAt && now < graceAt) {
      submittedRef.current = true; // 한 번만
      const timer = window.setTimeout(() => void submit(true), 0);
      return () => window.clearTimeout(timer);
    }
    if (now >= graceAt && reportedRef.current !== turnStartedAt) {
      reportedRef.current = turnStartedAt;
      requestJson(`/api/games/phone/rooms/${room.id}/timeout`, { method: 'POST' })
        .then(() => onRefresh())
        .catch(() => {
          reportedRef.current = null;
        });
    }
    return undefined;
    // submit은 렌더마다 새로 만들어지는 함수라 의존성에서 뺍니다(now가 바뀔 때만 확인하면 충분).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, expiredAt, taskSubmitted, turnStartedAt, room.id]);

  if (!task) return <p className="rummy__status">과제를 불러오는 중...</p>;

  const kindLabel = task.kind === 'text' ? (task.turn === 1 ? '첫 문장 쓰기' : '그림 설명하기') : '문장 그리기';
  const submitted = task.submitted && !editing;

  return (
    <div className="phone__work">
      <div className="phone__turnbar">
        <span className="phone__turn">
          턴 {task.turn} / {task.totalTurns} · <b>{kindLabel}</b>
        </span>
        <span className={`chess-room__clock ${remainingSec !== null && remainingSec <= 10 ? 'chess-room__clock--urgent' : ''}`}>⏱ {remainingSec ?? '–'}초</span>
        <span className="phone__done">완료 {doneCount} / {total}</span>
      </div>

      {/* 앞 칸 */}
      {task.turn === 1 ? (
        <p className="phone__prompt-hint">아무 문장이나 써 보세요. 엉뚱할수록 재밌어요. 떠오르지 않으면 <b>랜덤 문장</b>을 눌러요.</p>
      ) : task.previous?.kind === 'draw' ? (
        <div className="phone__prev">
          <p className="phone__prev-label">이 그림을 한 문장으로 설명해 주세요</p>
          {task.previous.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="앞 사람이 그린 그림" className="phone__prev-image" src={task.previous.image} />
          ) : (
            <div className="phone__prev-image phone__prev-image--empty">{entryPlaceholder(task.previous)} — 상상해서 써도 돼요</div>
          )}
        </div>
      ) : (
        <div className="phone__prev">
          <p className="phone__prev-label">이 문장을 그림으로 그려 주세요</p>
          <p className="phone__prev-text">{task.previous?.text || (task.previous ? entryPlaceholder(task.previous) : '')}</p>
        </div>
      )}

      {/* 내 작업 */}
      {task.kind === 'text' ? (
        <div className="phone__text-work">
          {submitted ? (
            <div className="phone__submitted">
              <p>✅ 완료! 다른 사람을 기다리는 중 ({doneCount} / {total})</p>
              <p className="phone__mine">“{task.mine?.text ?? text}”</p>
              <button className="rummy__btn rummy__btn--ghost" onClick={() => setEditing(true)} type="button">
                고치기
              </button>
            </div>
          ) : (
            <form
              className="phone__form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                aria-label="문장"
                autoFocus
                className="phone__input"
                maxLength={MAX_TEXT_LENGTH}
                onChange={(e) => setText(e.target.value)}
                placeholder={task.turn === 1 ? '예: 고양이가 배달 오토바이를 타고 캠퍼스로 온다' : '무엇을 그린 걸까요?'}
                type="text"
                value={text}
              />
              <div className="rummy__actions">
                {task.turn === 1 && (
                  <button className="rummy__btn rummy__btn--ghost" onClick={() => setText(PROMPT_IDEAS[Math.floor(Math.random() * PROMPT_IDEAS.length)])} type="button">
                    🎲 랜덤 문장
                  </button>
                )}
                <button className="rummy__btn" disabled={sending || !text.trim()} type="submit">
                  완료
                </button>
                <span className="phone__counter">
                  {text.length} / {MAX_TEXT_LENGTH}
                </span>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="phone__draw-work">
          <DrawingCanvas disabled={submitted || sending} ref={canvasRef} />
          {submitted ? (
            <div className="phone__submitted">
              <p>✅ 완료! 다른 사람을 기다리는 중 ({doneCount} / {total})</p>
              <button className="rummy__btn rummy__btn--ghost" onClick={() => setEditing(true)} type="button">
                고치기
              </button>
            </div>
          ) : (
            <div className="rummy__actions">
              <button className="rummy__btn" disabled={sending} onClick={() => void submit()} type="button">
                {sending ? '보내는 중...' : '완료'}
              </button>
              <span className="phone__counter">다 그렸으면 완료. 시간이 끝나면 그대로 제출돼요.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 앨범 공개 화면 ----------
// 기본은 방장이 넘기는 대로 다 같이 보기. "자유롭게 보기"로 바꾸면 방장 진행과 무관하게
// 모든 앨범을 끝까지 각자 볼 수 있습니다 — 방장이 자리를 비워도 앨범이 갇히지 않게.

function AlbumViewer({ room, albums, isHost, busy, onPost }: { room: Room; albums: AlbumSummary[]; isHost: boolean; busy: boolean; onPost: (path: string, body?: unknown, fallback?: string) => Promise<boolean>; }) {
  const [mode, setMode] = useState<'follow' | 'free'>('follow');
  const [freeIndex, setFreeIndex] = useState(0);
  const { album: albumIndex, step } = room.reveal;
  const shownIndex = mode === 'free' ? Math.min(freeIndex, Math.max(0, albums.length - 1)) : albumIndex;
  const { data } = useSWR<{ album: { owner: RoomPlayer; entries: AlbumEntry[]; length: number } }>(
    mode === 'free'
      ? `/api/games/phone/rooms/${room.id}/album?index=${shownIndex}&full=1`
      : `/api/games/phone/rooms/${room.id}/album?index=${albumIndex}&step=${step}&v=${room.version}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const album = data?.album;
  const endRef = useRef<HTMLDivElement>(null);
  const entryCount = album?.entries.length ?? 0;
  useEffect(() => {
    if (mode === 'free') return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entryCount, albumIndex, mode]);

  const current = albums[shownIndex];
  const isLastAlbum = albumIndex >= albums.length - 1;
  const allRevealed = Boolean(albums[albumIndex] && step >= albums[albumIndex].length);
  const finished = isLastAlbum && allRevealed;

  return (
    <div className="phone__album">
      <div className="phone__album-tabs" role="tablist" aria-label="앨범 목록">
        {albums.map((a) => (
          <button
            aria-selected={a.index === shownIndex}
            className={`phone__album-tab ${a.index === shownIndex ? 'phone__album-tab--active' : ''} ${a.revealed >= a.length && a.length > 0 ? 'phone__album-tab--done' : ''}`}
            disabled={busy || (mode === 'follow' && !isHost)}
            key={a.ownerId}
            onClick={() => {
              if (mode === 'free') setFreeIndex(a.index);
              else void onPost('reveal', { type: 'album', album: a.index });
            }}
            role="tab"
            title={mode === 'free' || isHost ? `${a.ownerName}의 앨범으로` : undefined}
            type="button"
          >
            {a.ownerName} <span className="phone__album-progress">{mode === 'free' ? a.length : `${a.revealed}/${a.length}`}</span>
          </button>
        ))}
        <button className="phone__mode-toggle" onClick={() => setMode((m) => (m === 'follow' ? 'free' : 'follow'))} type="button">
          {mode === 'follow' ? '🔍 자유롭게 보기' : '👥 같이 보기로'}
        </button>
      </div>

      <h3 className="phone__album-title">
        🎞 {current?.ownerName ?? '…'}의 앨범 <span className="phone__album-count">({shownIndex + 1} / {albums.length})</span>
      </h3>

      <ol className="phone__entries">
        {album?.entries.map((e) => (
          <li className={`phone__entry phone__entry--${e.kind}`} key={e.turn}>
            <div className="phone__entry-author">
              <span className="phone__entry-turn">{e.turn}</span>
              {e.authorName}
              {e.kind === 'text' ? ' 님이 썼어요' : ' 님이 그렸어요'}
              {e.status !== 'ok' ? <span className="phone__entry-flag">{e.status === 'left' ? '자리 비움' : '시간 초과'}</span> : null}
            </div>
            {e.kind === 'text' ? (
              <p className="phone__entry-text">{e.text || entryPlaceholder(e)}</p>
            ) : e.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${e.authorName}의 그림`} className="phone__entry-image" src={e.image} />
            ) : (
              <div className="phone__entry-image phone__entry-image--empty">{entryPlaceholder(e)}</div>
            )}
          </li>
        ))}
        {entryCount === 0 && (
          <li className="phone__entry-empty">
            {mode === 'free' ? '이 앨범은 비어 있어요.' : isHost ? '다음 ▶ 을 눌러 첫 칸을 공개하세요.' : '방장이 첫 칸을 공개하길 기다리는 중… (🔍 자유롭게 보기로 먼저 볼 수도 있어요)'}
          </li>
        )}
        <div ref={endRef} />
      </ol>

      {mode === 'free' ? (
        <div className="rummy__actions phone__reveal-controls">
          <button className="rummy__btn rummy__btn--ghost" disabled={shownIndex === 0} onClick={() => setFreeIndex(shownIndex - 1)} type="button">
            ◀ 이전 앨범
          </button>
          <button className="rummy__btn" disabled={shownIndex >= albums.length - 1} onClick={() => setFreeIndex(shownIndex + 1)} type="button">
            다음 앨범 ▶
          </button>
          <span className="phone__reveal-note">자유롭게 보는 중 — 방장 진행과 상관없이 전부 볼 수 있어요.</span>
        </div>
      ) : isHost ? (
        <div className="rummy__actions phone__reveal-controls">
          <button className="rummy__btn rummy__btn--ghost" disabled={busy || (albumIndex === 0 && step === 0)} onClick={() => onPost('reveal', { type: 'prev' })} type="button">
            ◀ 이전
          </button>
          <button className="rummy__btn" disabled={busy || finished} onClick={() => onPost('reveal', { type: 'next' })} type="button">
            {allRevealed ? (isLastAlbum ? '끝' : '다음 앨범 ▶') : '다음 ▶'}
          </button>
          <button className="rummy__btn rummy__btn--ghost" disabled={busy || allRevealed} onClick={() => onPost('reveal', { type: 'all' })} type="button">
            이 앨범 전부 보기
          </button>
        </div>
      ) : (
        <p className="phone__reveal-note">{finished ? '모든 앨범을 봤어요. 방장이 한 판 더 열 수 있어요.' : '방장이 한 칸씩 넘겨요. 같이 보면서 웃어요 🙂'}</p>
      )}
    </div>
  );
}
