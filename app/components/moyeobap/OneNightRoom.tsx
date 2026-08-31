'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { POLLING_PRESETS } from '../../lib/swrConfig';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  CENTER_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROLE_EMOJI,
  ROLE_LABEL,
  ROLE_SUMMARY,
  remainingMs,
  type NightAction,
  type OneNightRoom as Room,
  type Role,
  type RoomPlayer,
} from '../../lib/onenightMatch';
import type { PrivateView } from '../../lib/onenightOnline';
import { useAuth } from './AuthProvider';
import { GameChat, type GameChatConfig } from './GameChat';
import { Spectators } from './Spectators';
import { OneNightRulebook } from './OneNightRulebook';

/** 지금 페이즈에 주어진 시간(초). 대기·종료 화면에는 타이머가 없습니다. */
function phaseSeconds(room: Room): number {
  if (room.status === 'night') return room.settings.nightSec;
  if (room.status === 'day') return room.settings.daySec;
  if (room.status === 'voting') return room.settings.voteSec;
  return 0;
}

const CHAT_CONFIG: GameChatConfig<'player' | 'spectator'> = {
  apiBase: '/api/games/onenight/rooms',
  table: 'onenight_chat_messages',
  channelPrefix: 'onenight-chat',
  emojis: true,
  roleLabel: { player: '플레이어', spectator: '구경' },
};

const PHASE_LABEL: Record<Room['status'], string> = {
  waiting: '대기 중',
  night: '🌙 밤',
  day: '☀️ 낮 — 이야기해요',
  voting: '🗳 투표',
  finished: '결과',
};

function Avatar({ player, size = 24 }: { player: Pick<RoomPlayer, 'name' | 'avatarUrl'>; size?: number }) {
  if (player.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className="onenight__avatar" height={size} referrerPolicy="no-referrer" src={player.avatarUrl} width={size} />;
  }
  return (
    <span className="onenight__avatar onenight__avatar--initial" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {player.name.charAt(0)}
    </span>
  );
}

function RoleCard({ role, note }: { role: Role; note?: string }) {
  return (
    <div className={`onenight-role ${role === 'werewolf' ? 'onenight-role--wolf' : ''}`}>
      <span className="onenight-role__emoji" aria-hidden="true">{ROLE_EMOJI[role]}</span>
      <div>
        <strong className="onenight-role__name">{ROLE_LABEL[role]}</strong>
        <p className="onenight-role__desc">{note ?? ROLE_SUMMARY[role]}</p>
      </div>
    </div>
  );
}

function formatClock(ms: number | null): string {
  if (ms === null) return '';
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}초`;
}

/** 밤에 각자가 본 것을 한국어 한두 줄로 풉니다. 낮에 이 문장을 그대로 읽으면 됩니다. */
function knowledgeLines(view: PrivateView, players: RoomPlayer[]): string[] {
  const k = view.knowledge;
  if (!k) return [];
  const name = (seat: number) => players[seat]?.name ?? `${seat + 1}번`;
  const lines: string[] = [];

  if (view.startRole === 'werewolf') {
    lines.push(
      k.wolfPartners.length
        ? `같은 늑대는 ${k.wolfPartners.map(name).join(', ')}님이에요.`
        : '늑대는 나 혼자예요.',
    );
  }
  if (k.loneWolfCenter) {
    lines.push(`가운데 ${k.loneWolfCenter.index + 1}번 카드는 ${ROLE_LABEL[k.loneWolfCenter.role]}였어요.`);
  }
  if (view.startRole === 'mason') {
    lines.push(
      k.masonPartners.length
        ? `다른 프리메이슨은 ${k.masonPartners.map(name).join(', ')}님이에요.`
        : '프리메이슨은 나 혼자예요 (다른 한 장은 가운데에 있어요).',
    );
  }
  if (k.seerPeek?.kind === 'player') {
    lines.push(`${name(k.seerPeek.seat)}님의 카드는 ${ROLE_LABEL[k.seerPeek.role]}였어요.`);
  }
  if (k.seerPeek?.kind === 'center') {
    lines.push(
      `가운데 ${k.seerPeek.cards.map((c) => `${c.index + 1}번 ${ROLE_LABEL[c.role]}`).join(', ')}였어요.`,
    );
  }
  if (k.robbed) {
    lines.push(`${name(k.robbed.seat)}님의 카드를 가져왔어요. 지금 내 카드는 ${ROLE_LABEL[k.robbed.role]}예요.`);
  }
  if (k.swapped) {
    lines.push(`${name(k.swapped[0])}님과 ${name(k.swapped[1])}님의 카드를 서로 바꿨어요. 뭐였는지는 몰라요.`);
  }
  if (k.drunkTook !== undefined) {
    lines.push(`가운데 ${k.drunkTook + 1}번 카드와 내 카드를 바꿨어요. 뭘 가져왔는지는 몰라요.`);
  }
  if (k.insomniaSaw) {
    lines.push(
      k.insomniaSaw === view.startRole
        ? '밤이 끝나고 확인해 보니 내 카드는 그대로였어요.'
        : `밤이 끝나고 확인해 보니 내 카드가 ${ROLE_LABEL[k.insomniaSaw]}로 바뀌어 있었어요!`,
    );
  }
  if (!lines.length) lines.push('밤에 알게 된 건 없어요. 다른 사람들 이야기를 잘 들어 보세요.');
  return lines;
}

export function OneNightRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { data, error, mutate } = useSWR<{ room: Room; view: PrivateView | null }>(
    `/api/games/onenight/rooms/${roomId}`,
    fetcher,
    POLLING_PRESETS.GAME_ROOM,
  );
  const room = data?.room;
  const view = data?.view ?? null;

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // 고른 것을 단계와 함께 들고 있습니다. 단계가 바뀌면 effect로 지우는 대신
  // 값이 낡은 것으로 보고 무시합니다(React Compiler가 effect 안의 setState를 막습니다).
  const [pickState, setPickState] = useState<{ phase: string; seats: number[] }>({ phase: '', seats: [] });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }
    const channel = supabase
      .channel(`onenight-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'onenight_rooms', filter: `id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  // 접속 표시(🟢)와 관전자 이름. 자리에 앉지 않고 들어와 있는 사람이 관전자입니다.
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
    const channel = supabase.channel(`onenight-presence-${roomId}`, { config: { presence: { key: currentUser.id } } });
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // 페이즈 전환(토론 시간 종료 등)은 서버가 방을 "읽을 때" 계산합니다. 그래서
  // 아무도 부르지 않으면 타이머가 0:00을 찍고도 다음 폴링(8초)까지 화면이 멈춰
  // 보입니다. 만료된 순간 한 번 더 불러 전환을 앞당깁니다 — 알까기가 턴 시간을
  // 넘겼을 때 /timeout을 부르는 것과 같은 방식입니다.
  //
  // 한 페이즈당 한 번만 부릅니다. 전환에 성공하면 status가 바뀌어 다음 페이즈
  // 키가 되고, 실패했다면 원래대로 폴링이 받아 갑니다.
  const expiredPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room?.phaseStartedAt) return;
    const seconds = phaseSeconds(room);
    if (seconds <= 0) return;
    const key = `${room.status}:${room.phaseStartedAt}`;
    if (expiredPhaseRef.current === key) return;
    if ((remainingMs(room.phaseStartedAt, seconds, now) ?? 1) > 0) return;
    expiredPhaseRef.current = key;
    void mutate();
  }, [room, now, mutate]);

  if (error) return <p className="onenight__notice">방을 불러오지 못했어요.</p>;
  if (!room) return <p className="onenight__notice">불러오는 중…</p>;

  const players = room.players;
  const seated = players.filter((p) => !p.left);
  const isHost = currentUser?.id === room.hostId;
  const isPlayer = !!currentUser && seated.some((p) => p.id === currentUser.id);
  const mySeat = view?.seat ?? -1;

  const phaseSec = phaseSeconds(room);
  const left = room.status === 'waiting' || room.status === 'finished' ? null : remainingMs(room.phaseStartedAt, phaseSec, now);

  async function call(path: string, body?: unknown) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestJson(`/api/games/onenight/rooms/${roomId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await mutate();
    } catch (err) {
      setMessage(getErrorMessage(err, '잠시 뒤 다시 시도해주세요.'));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    await call('/leave');
    router.push('/games/onenight');
  }

  async function close() {
    await call('/close');
    router.push('/games/onenight');
  }

  const phase = room.status;
  const picks = pickState.phase === phase ? pickState.seats : [];

  function toggle(index: number, max: number) {
    setPickState((prev) => {
      const current = prev.phase === phase ? prev.seats : [];
      const seats = current.includes(index)
        ? current.filter((i) => i !== index)
        : current.length >= max
          ? [...current.slice(1), index]
          : [...current, index];
      return { phase, seats };
    });
  }

  return (
    <div className="onenight">
      <header className="onenight__head">
        <div className="onenight__head-main">
          <h1 className="onenight__title">{room.roomName}</h1>
          <span className="onenight__phase">{PHASE_LABEL[room.status]}</span>
          {left !== null && <span className="onenight__clock">{formatClock(left)}</span>}
          <Spectators className="onenight__spectators" names={spectators} />
        </div>
        <div className="onenight__head-tools">
          <OneNightRulebook playerCount={seated.length} />
          {isHost && room.status === 'waiting' && (
            confirmingClose ? (
              <>
                <button className="onenight-btn onenight-btn--danger" disabled={busy} onClick={close} type="button">정말 없앨래요</button>
                <button className="onenight-btn" onClick={() => setConfirmingClose(false)} type="button">취소</button>
              </>
            ) : (
              <button className="onenight-btn" onClick={() => setConfirmingClose(true)} type="button">🗑 방 없애기</button>
            )
          )}
          {confirmingLeave ? (
            <>
              <button className="onenight-btn onenight-btn--danger" disabled={busy} onClick={leave} type="button">정말 나갈래요</button>
              <button className="onenight-btn" onClick={() => setConfirmingLeave(false)} type="button">취소</button>
            </>
          ) : (
            <button className="onenight-btn" onClick={() => setConfirmingLeave(true)} type="button">나가기</button>
          )}
        </div>
      </header>

      {message && <p className="onenight__error">{message}</p>}

      <div className="onenight__layout">
        <section className="onenight__main">
          {/* ── 대기 ── */}
          {room.status === 'waiting' && (
            <>
              <p className="onenight__notice">
                {seated.length}명 모였어요. {MIN_PLAYERS}~{MAX_PLAYERS}명이면 시작할 수 있어요.
                {seated.length < MIN_PLAYERS && ` ${MIN_PLAYERS - seated.length}명만 더 오면 돼요.`}
              </p>
              <ul className="onenight__seats">
                {seated.map((p) => (
                  <li className="onenight__seat" key={p.id}>
                    <Avatar player={p} />
                    <span>{p.name}</span>
                    {p.id === room.hostId && <span className="onenight__tag">방장</span>}
                    {isHost && p.id !== room.hostId && (
                      <button className="onenight__kick" disabled={busy} onClick={() => call('/kick', { targetId: p.id })} type="button">
                        내보내기
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {isHost && (
                <button
                  className="onenight-btn onenight-btn--primary onenight-btn--wide"
                  disabled={busy || seated.length < MIN_PLAYERS}
                  onClick={() => call('/start')}
                  type="button"
                >
                  {seated.length < MIN_PLAYERS ? `${MIN_PLAYERS}명부터 시작할 수 있어요` : '게임 시작'}
                </button>
              )}
              {!isHost && <p className="onenight__notice">방장이 시작하기를 기다리는 중이에요.</p>}
            </>
          )}

          {/* ── 밤 ── */}
          {room.status === 'night' && view && (
            <NightPanel
              busy={busy}
              onSubmit={(action) => call('/night', { action })}
              picks={picks}
              players={seated}
              room={room}
              toggle={toggle}
              view={view}
            />
          )}
          {room.status === 'night' && !view && (
            <p className="onenight__notice">🌙 밤이에요. 참가자들이 각자 카드를 확인하고 있어요.</p>
          )}

          {/* ── 낮 ── */}
          {room.status === 'day' && (
            <>
              {view && (
                <>
                  <RoleCard role={view.startRole} />
                  <div className="onenight__knowledge">
                    <h3>내가 밤에 알게 된 것</h3>
                    <ul>
                      {knowledgeLines(view, players).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="onenight__hint">
                      이걸 그대로 말해도 되고, 숨겨도 돼요. 늑대라면 당연히 다르게 말해야겠죠.
                    </p>
                  </div>
                </>
              )}
              {!view && <p className="onenight__notice">참가자들이 이야기하는 중이에요.</p>}
              {isHost && (
                <button className="onenight-btn onenight-btn--primary onenight-btn--wide" disabled={busy} onClick={() => call('/advance')} type="button">
                  바로 투표하기
                </button>
              )}
            </>
          )}

          {/* ── 투표 ── */}
          {room.status === 'voting' && (
            <>
              <h3 className="onenight__subhead">늑대인간이라고 생각하는 사람을 골라주세요</h3>
              <p className="onenight__hint">
                가장 많이 지목된 사람이 죽어요. 전부 1표씩이면 아무도 안 죽어요.
              </p>
              <ul className="onenight__vote-list">
                {seated.map((p, seat) => (
                  <li key={p.id}>
                    <button
                      className={`onenight__vote ${view?.myVote === seat ? 'is-picked' : ''}`}
                      disabled={busy || !isPlayer || seat === mySeat}
                      onClick={() => call('/vote', { seat })}
                      type="button"
                    >
                      <Avatar player={p} />
                      <span>{p.name}</span>
                      {seat === mySeat && <span className="onenight__tag">나</span>}
                      {view?.myVote === seat && <span className="onenight__tag onenight__tag--pick">지목</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="onenight__notice">
                {room.voted.length} / {seated.length}명이 투표했어요.
              </p>
            </>
          )}

          {/* ── 결과 ── */}
          {room.status === 'finished' && room.result && (
            <ResultPanel isHost={isHost} busy={busy} onRestart={() => call('/restart')} players={players} result={room.result} />
          )}
        </section>

        <aside className="onenight__side">
          <div className="onenight__roster">
            <h3>참가자 {seated.length}명</h3>
            <ul>
              {seated.map((p) => (
                <li key={p.id}>
                  <Avatar player={p} size={20} />
                  <span aria-label={onlineIds.has(p.id) ? '접속 중' : '접속 끊김'} className="onenight__online">
                    {onlineIds.has(p.id) ? '🟢' : '⚪'}
                  </span>
                  <span>{p.name}</span>
                  {room.status === 'night' && room.nightSubmitted.includes(p.id) && <span className="onenight__done">✓</span>}
                  {room.status === 'voting' && room.voted.includes(p.id) && <span className="onenight__done">✓</span>}
                </li>
              ))}
            </ul>
          </div>
          {currentUser && (
            <GameChat config={CHAT_CONFIG} myRole={isPlayer ? 'player' : 'spectator'} roomId={roomId} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ── 밤 화면 ──────────────────────────────────────────────────────────

function NightPanel({
  busy,
  onSubmit,
  picks,
  players,
  room,
  toggle,
  view,
}: {
  busy: boolean;
  onSubmit: (action: NightAction) => void;
  picks: number[];
  players: RoomPlayer[];
  room: Room;
  toggle: (index: number, max: number) => void;
  view: PrivateView;
}) {
  const [centerMode, setCenterMode] = useState(false);
  const role = view.startRole;
  const done = view.myAction !== null;

  const centerCards = Array.from({ length: CENTER_COUNT }, (_, i) => i);
  const others = players.map((p, seat) => ({ p, seat })).filter(({ seat }) => seat !== view.seat);

  function submit() {
    let action: NightAction | null = null;
    if (role === 'seer') {
      action = centerMode
        ? picks.length === 2 ? { kind: 'seerCenter', cards: [picks[0], picks[1]] } : null
        : picks.length === 1 ? { kind: 'seerPlayer', seat: picks[0] } : null;
    } else if (role === 'robber' && picks.length === 1) action = { kind: 'robber', seat: picks[0] };
    else if (role === 'troublemaker' && picks.length === 2) action = { kind: 'troublemaker', seats: [picks[0], picks[1]] };
    else if (role === 'drunk' && picks.length === 1) action = { kind: 'drunk', card: picks[0] };
    else if (role === 'werewolf' && picks.length === 1) action = { kind: 'loneWolf', card: picks[0] };
    if (action) onSubmit(action);
  }

  return (
    <div className="onenight__night">
      <RoleCard role={role} />

      {done && (
        <p className="onenight__notice">
          ✓ 다 골랐어요. 다른 사람들을 기다리는 중이에요 ({room.nightSubmitted.length}/{players.length}).
        </p>
      )}

      {!done && !view.needsChoice && (
        <p className="onenight__notice">
          이 역할은 밤에 고를 게 없어요. 잠시 뒤 아침이 밝아요.
        </p>
      )}

      {!done && view.needsChoice && (
        <>
          {role === 'seer' && (
            <div className="onenight__mode">
              <button className={`onenight-btn ${!centerMode ? 'onenight-btn--primary' : ''}`} onClick={() => setCenterMode(false)} type="button">
                한 사람 카드 보기
              </button>
              <button className={`onenight-btn ${centerMode ? 'onenight-btn--primary' : ''}`} onClick={() => setCenterMode(true)} type="button">
                가운데 2장 보기
              </button>
            </div>
          )}

          <p className="onenight__hint">
            {role === 'seer' && (centerMode ? '가운데 카드 2장을 골라주세요.' : '카드를 볼 사람 한 명을 골라주세요.')}
            {role === 'robber' && '카드를 바꿔 올 사람 한 명을 골라주세요. 무엇인지는 바꾼 뒤에 알려드려요.'}
            {role === 'troublemaker' && '나를 뺀 두 사람을 골라주세요. 그 둘의 카드가 서로 바뀌어요.'}
            {role === 'drunk' && '가운데 카드 한 장을 골라주세요. 내 카드와 바뀌지만 무엇인지는 알 수 없어요.'}
            {role === 'werewolf' && '늑대는 나 혼자예요. 가운데 카드 한 장을 볼 수 있어요.'}
          </p>

          {(role === 'seer' && !centerMode) || role === 'robber' || role === 'troublemaker' ? (
            <ul className="onenight__pick-list">
              {others.map(({ p, seat }) => (
                <li key={p.id}>
                  <button
                    className={`onenight__pick ${picks.includes(seat) ? 'is-picked' : ''}`}
                    onClick={() => toggle(seat, role === 'troublemaker' ? 2 : 1)}
                    type="button"
                  >
                    <Avatar player={p} />
                    <span>{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="onenight__pick-list onenight__pick-list--center">
              {centerCards.map((i) => (
                <li key={i}>
                  <button
                    className={`onenight__pick onenight__pick--card ${picks.includes(i) ? 'is-picked' : ''}`}
                    onClick={() => toggle(i, role === 'seer' ? 2 : 1)}
                    type="button"
                  >
                    <span className="onenight__card-back" aria-hidden="true">🂠</span>
                    <span>가운데 {i + 1}번</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="onenight-btn onenight-btn--primary onenight-btn--wide" disabled={busy} onClick={submit} type="button">
            이걸로 할게요
          </button>
        </>
      )}
    </div>
  );
}

// ── 결과 화면 ────────────────────────────────────────────────────────

function ResultPanel({
  busy,
  isHost,
  onRestart,
  players,
  result,
}: {
  busy: boolean;
  isHost: boolean;
  onRestart: () => void;
  players: RoomPlayer[];
  result: NonNullable<Room['result']>;
}) {
  const winnerLabel =
    result.winners.includes('village') && result.winners.includes('werewolf')
      ? '무승부'
      : result.winners.includes('village')
        ? '🎉 마을팀 승리'
        : result.winners.includes('werewolf')
          ? '🐺 늑대팀 승리'
          : '아무도 이기지 못했어요';

  return (
    <div className="onenight__result">
      <h2 className={`onenight__winner ${result.winners.includes('werewolf') ? 'is-wolf' : ''}`}>{winnerLabel}</h2>
      <p className="onenight__reason">{result.reason}</p>

      <ul className="onenight__reveal">
        {players.map((p, seat) => {
          const start = result.startRoles[seat];
          const final = result.finalRoles[seat];
          const changed = start !== final;
          const dead = result.dead.includes(seat);
          return (
            <li className={`onenight__reveal-row ${dead ? 'is-dead' : ''}`} key={p.id}>
              <Avatar player={p} />
              <span className="onenight__reveal-name">{p.name}</span>
              <span className="onenight__reveal-roles">
                {ROLE_EMOJI[start]} {ROLE_LABEL[start]}
                {changed && <> → <strong>{ROLE_EMOJI[final]} {ROLE_LABEL[final]}</strong></>}
              </span>
              <span className="onenight__reveal-votes">{result.tally[seat]}표</span>
              {dead && <span className="onenight__tag onenight__tag--dead">사망</span>}
            </li>
          );
        })}
      </ul>

      <div className="onenight__center-reveal">
        <h3>가운데 카드</h3>
        <p>{result.finalCenter.map((r, i) => `${i + 1}번 ${ROLE_LABEL[r]}`).join(' · ')}</p>
      </div>

      {isHost && (
        <button className="onenight-btn onenight-btn--primary onenight-btn--wide" disabled={busy} onClick={onRestart} type="button">
          한 판 더
        </button>
      )}
    </div>
  );
}
