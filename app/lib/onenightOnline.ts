import { getSupabase } from "./supabase";
import {
  CENTER_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PHASE_GRACE_MS,
  dealRoles,
  deckFor,
  judge,
  makeRng,
  needsNightChoice,
  remainingMs,
  resolveNight,
  resolveVotes,
  type GameResult,
  type NightAction,
  type NightKnowledge,
  type OneNightRoom,
  type Role,
  type RoomPlayer,
  type RoomSettings,
} from "./onenightMatch";

// 원나잇 인랑 서버 로직.
//
// 이 게임의 전부는 "누가 무슨 카드인지"이므로, 카드는 참여자가 구독할 수 있는
// onenight_rooms에 절대 두지 않고 서버 전용 onenight_deals에만 둡니다.
// 각자에게는 getPrivateView가 자기 몫만 골라서 내려줍니다.

export { MIN_PLAYERS, MAX_PLAYERS } from "./onenightMatch";
export type { OneNightRoom, RoomPlayer } from "./onenightMatch";

/** 2시간 동안 아무 움직임이 없는 방은 상태와 무관하게 정리합니다. */
const STALE_ROOM_TTL_MS = 2 * 60 * 60 * 1000;

type RoomRow = {
  id: string;
  room_name: string;
  status: OneNightRoom["status"];
  host_id: string | null;
  players: RoomPlayer[];
  settings: RoomSettings;
  night_submitted: string[];
  voted: string[];
  result: GameResult | null;
  version: number;
  phase_started_at: string | null;
  created_at: string;
};

type DealRow = {
  room_id: string;
  seat_ids: string[];
  start_roles: Role[];
  start_center: Role[];
  final_roles: Role[] | null;
  final_center: Role[] | null;
  night_actions: (NightAction | null)[];
  knowledge: NightKnowledge[] | null;
  votes: (number | null)[];
};

const DEFAULT_SETTINGS: RoomSettings = { nightSec: 45, daySec: 180, voteSec: 30 };

function mapRow(row: RoomRow): OneNightRoom {
  return {
    id: row.id,
    roomName: row.room_name,
    status: row.status,
    hostId: row.host_id,
    players: Array.isArray(row.players) ? row.players : [],
    settings: row.settings ?? DEFAULT_SETTINGS,
    nightSubmitted: Array.isArray(row.night_submitted) ? row.night_submitted : [],
    voted: Array.isArray(row.voted) ? row.voted : [],
    result: row.result ?? null,
    version: row.version,
    phaseStartedAt: row.phase_started_at,
    createdAt: row.created_at,
  };
}

type Outcome = { room: OneNightRoom } | { error: string };

const activePlayers = (room: OneNightRoom) => room.players.filter((p) => !p.left);

// ---------- 조회 ----------

async function cleanupStaleRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - STALE_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("onenight_rooms").delete().lt("updated_at", cutoff);
  if (error) console.error("onenight cleanup error:", error);
}

export async function listRooms(): Promise<OneNightRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  await cleanupStaleRooms();
  const { data, error } = await supabase
    .from("onenight_rooms")
    .select()
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return (data as RoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<OneNightRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("onenight_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as RoomRow);
}

async function getDeal(roomId: string): Promise<DealRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("onenight_deals").select().eq("room_id", roomId).maybeSingle();
  if (error || !data) return null;
  return data as DealRow;
}

/** version 조건을 붙인 갱신. 다른 요청이 먼저 처리됐으면 null. */
async function updateRoom(room: OneNightRoom, patch: Record<string, unknown>): Promise<OneNightRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("onenight_rooms")
    .update({ ...patch, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq("id", room.id)
    .eq("version", room.version)
    .select()
    .maybeSingle();
  if (error) {
    console.error("onenight updateRoom error:", error);
    return null;
  }
  return data ? mapRow(data as RoomRow) : null;
}

// ---------- 방 생성·참여 ----------

export async function createRoom(
  userId: string,
  userName: string,
  avatarUrl: string | undefined,
  roomName: string | undefined,
  settings: Partial<RoomSettings>,
): Promise<OneNightRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number(v) || fallback)));

  const { data, error } = await supabase
    .from("onenight_rooms")
    .insert({
      room_name: roomName?.trim().slice(0, 40) || `${userName}님의 방`,
      host_id: userId,
      players: [{ id: userId, name: userName, avatarUrl, left: false }],
      settings: {
        nightSec: clamp(settings.nightSec, 15, 120, DEFAULT_SETTINGS.nightSec),
        daySec: clamp(settings.daySec, 30, 600, DEFAULT_SETTINGS.daySec),
        voteSec: clamp(settings.voteSec, 10, 120, DEFAULT_SETTINGS.voteSec),
      },
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error("onenight createRoom error:", error);
    return null;
  }
  return mapRow(data as RoomRow);
}

export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
  avatarUrl?: string,
): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (room.players.some((p) => p.id === userId && !p.left)) return { room };
  if (room.status !== "waiting") return { error: "이미 시작한 판이에요. 다음 판을 기다려 주세요." };
  if (activePlayers(room).length >= MAX_PLAYERS) return { error: `최대 ${MAX_PLAYERS}명까지 들어갈 수 있어요.` };

  const players = room.players.some((p) => p.id === userId)
    ? room.players.map((p) => (p.id === userId ? { ...p, name: userName, avatarUrl, left: false } : p))
    : [...room.players, { id: userId, name: userName, avatarUrl, left: false }];

  const updated = await updateRoom(room, { players });
  return updated ? { room: updated } : { error: "잠시 뒤 다시 시도해주세요." };
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await getRoom(roomId);
    if (!room) return;
    if (!room.players.some((p) => p.id === userId)) return;

    // 대기 중에는 명단에서 지우고, 시작한 뒤에는 자리를 유지한 채 나간 표시만 합니다
    // (자리 번호가 밀리면 밤에 나눠 준 카드와 어긋납니다).
    const players =
      room.status === "waiting"
        ? room.players.filter((p) => p.id !== userId)
        : room.players.map((p) => (p.id === userId ? { ...p, left: true } : p));

    if (players.filter((p) => !p.left).length === 0) {
      await supabase.from("onenight_rooms").delete().eq("id", roomId);
      return;
    }

    const hostLeft = room.hostId === userId;
    const nextHost = hostLeft ? (players.find((p) => !p.left)?.id ?? null) : room.hostId;
    if (await updateRoom(room, { players, host_id: nextHost })) return;
  }
}

export async function kickPlayer(roomId: string, hostId: string, targetId: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (room.hostId !== hostId) return { error: "방장만 내보낼 수 있어요." };
  if (room.status !== "waiting") return { error: "대기 중에만 내보낼 수 있어요." };
  if (targetId === hostId) return { error: "자신은 내보낼 수 없어요." };

  const players = room.players.filter((p) => p.id !== targetId);
  const updated = await updateRoom(room, { players });
  return updated ? { room: updated } : { error: "잠시 뒤 다시 시도해주세요." };
}

export async function closeRoom(roomId: string, hostId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "잠시 뒤 다시 시도해주세요." };
  const room = await getRoom(roomId);
  if (!room) return { ok: true };
  if (room.hostId !== hostId) return { error: "방장만 방을 없앨 수 있어요." };
  const { error } = await supabase.from("onenight_rooms").delete().eq("id", roomId);
  return error ? { error: "방을 없애지 못했어요." } : { ok: true };
}

// ---------- 판 시작 ----------

async function dealAndStart(room: OneNightRoom): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "잠시 뒤 다시 시도해주세요." };

  const seats = activePlayers(room);
  if (seats.length < MIN_PLAYERS) return { error: `${MIN_PLAYERS}명부터 시작할 수 있어요.` };
  if (seats.length > MAX_PLAYERS) return { error: `${MAX_PLAYERS}명까지만 가능해요.` };

  const rng = makeRng(Math.floor(Math.random() * 2 ** 31));
  const { startRoles, center } = dealRoles(deckFor(seats.length), seats.length, rng);

  const { error } = await supabase.from("onenight_deals").upsert(
    {
      room_id: room.id,
      seat_ids: seats.map((p) => p.id),
      start_roles: startRoles,
      start_center: center,
      final_roles: null,
      final_center: null,
      night_actions: seats.map(() => null),
      knowledge: null,
      votes: seats.map(() => null),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id" },
  );
  if (error) {
    console.error("onenight deal error:", error);
    return { error: "카드를 나누지 못했어요. 잠시 뒤 다시 시도해주세요." };
  }

  // 나간 사람을 뺀 명단으로 자리를 고정합니다.
  const updated = await updateRoom(room, {
    status: "night",
    players: seats,
    night_submitted: [],
    voted: [],
    result: null,
    phase_started_at: new Date().toISOString(),
  });
  return updated ? { room: updated } : { error: "잠시 뒤 다시 시도해주세요." };
}

export async function startGame(roomId: string, userId: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (room.hostId !== userId) return { error: "방장만 시작할 수 있어요." };
  if (room.status !== "waiting") return { error: "이미 시작했어요." };
  return dealAndStart(room);
}

export async function restartGame(roomId: string, userId: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (room.hostId !== userId) return { error: "방장만 다시 시작할 수 있어요." };
  if (room.status !== "finished") return { error: "아직 판이 끝나지 않았어요." };
  return dealAndStart(room);
}

// ---------- 각자에게 내려줄 몫 ----------

export type PrivateView = {
  seat: number;
  startRole: Role;
  /** 밤에 골라야 할 게 있으면 true. */
  needsChoice: boolean;
  /** 내가 낸 밤 행동(다시 들어와도 보이게). */
  myAction: NightAction | null;
  /** 밤이 해소된 뒤 내가 알게 된 것. */
  knowledge: NightKnowledge | null;
  /** 내가 찍은 사람의 자리. */
  myVote: number | null;
};

export async function getPrivateView(room: OneNightRoom, userId: string): Promise<PrivateView | null> {
  if (room.status === "waiting") return null;
  const deal = await getDeal(room.id);
  if (!deal) return null;

  const seat = deal.seat_ids.indexOf(userId);
  if (seat < 0) return null;

  const startRole = deal.start_roles[seat];
  const wolfPartners = deal.start_roles.filter((r, i) => r === "werewolf" && i !== seat).length;

  return {
    seat,
    startRole,
    needsChoice: needsNightChoice(startRole, wolfPartners),
    myAction: deal.night_actions[seat] ?? null,
    // 밤이 끝나기 전에는 내 지식도 안 내려줍니다(예언자 결과는 밤이 해소돼야 나옵니다).
    knowledge: deal.knowledge ? deal.knowledge[seat] : null,
    myVote: deal.votes[seat] ?? null,
  };
}

// ---------- 밤 ----------

/** 밤에 낼 수 있는 행동인지 확인합니다. 여기서 막지 못한 건 resolveNight가 무시합니다. */
function parseNightAction(raw: unknown, role: Role, seat: number, playerCount: number): NightAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const isSeat = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < playerCount;
  const isCard = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < CENTER_COUNT;

  switch (a.kind) {
    case "seerPlayer":
      if (role !== "seer" || !isSeat(a.seat) || a.seat === seat) return null;
      return { kind: "seerPlayer", seat: a.seat as number };
    case "seerCenter": {
      if (role !== "seer" || !Array.isArray(a.cards) || a.cards.length !== 2) return null;
      const [x, y] = a.cards;
      if (!isCard(x) || !isCard(y) || x === y) return null;
      return { kind: "seerCenter", cards: [x as number, y as number] };
    }
    case "robber":
      if (role !== "robber" || !isSeat(a.seat) || a.seat === seat) return null;
      return { kind: "robber", seat: a.seat as number };
    case "troublemaker": {
      if (role !== "troublemaker" || !Array.isArray(a.seats) || a.seats.length !== 2) return null;
      const [x, y] = a.seats;
      if (!isSeat(x) || !isSeat(y) || x === y || x === seat || y === seat) return null;
      return { kind: "troublemaker", seats: [x as number, y as number] };
    }
    case "drunk":
      if (role !== "drunk" || !isCard(a.card)) return null;
      return { kind: "drunk", card: a.card as number };
    case "loneWolf":
      if (role !== "werewolf" || !isCard(a.card)) return null;
      return { kind: "loneWolf", card: a.card as number };
    default:
      return null;
  }
}

export async function submitNightAction(roomId: string, userId: string, raw: unknown): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "잠시 뒤 다시 시도해주세요." };

  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (room.status !== "night") return { error: "지금은 밤이 아니에요." };

  const deal = await getDeal(roomId);
  if (!deal) return { error: "카드를 찾을 수 없어요." };
  const seat = deal.seat_ids.indexOf(userId);
  if (seat < 0) return { error: "이 판의 참가자가 아니에요." };

  const action = parseNightAction(raw, deal.start_roles[seat], seat, deal.seat_ids.length);
  if (!action) return { error: "고를 수 없는 대상이에요." };

  const actions = deal.night_actions.slice();
  actions[seat] = action;
  const { error } = await supabase
    .from("onenight_deals")
    .update({ night_actions: actions, updated_at: new Date().toISOString() })
    .eq("room_id", roomId);
  if (error) return { error: "잠시 뒤 다시 시도해주세요." };

  const submitted = room.nightSubmitted.includes(userId) ? room.nightSubmitted : [...room.nightSubmitted, userId];
  const updated = await updateRoom(room, { night_submitted: submitted });
  return { room: updated ?? room };
}

/** 밤을 닫고 결과를 계산합니다. 전원이 냈거나 시간이 다 됐을 때 호출됩니다. */
async function closeNight(room: OneNightRoom): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "잠시 뒤 다시 시도해주세요." };

  const deal = await getDeal(room.id);
  if (!deal) return { error: "카드를 찾을 수 없어요." };

  // 취객은 반드시 한 장을 바꿔야 하는 역할이라, 시간이 지나 못 골랐으면 대신 골라 줍니다.
  const actions = deal.night_actions.slice();
  deal.start_roles.forEach((role, seat) => {
    if (role === "drunk" && !actions[seat]) {
      actions[seat] = { kind: "drunk", card: Math.floor(Math.random() * CENTER_COUNT) };
    }
  });

  const night = resolveNight(deal.start_roles, deal.start_center, actions);
  const { error } = await supabase
    .from("onenight_deals")
    .update({
      night_actions: actions,
      final_roles: night.finalRoles,
      final_center: night.finalCenter,
      knowledge: night.knowledge,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id);
  if (error) return { error: "밤을 넘기지 못했어요." };

  const updated = await updateRoom(room, { status: "day", phase_started_at: new Date().toISOString() });
  return updated ? { room: updated } : { error: "잠시 뒤 다시 시도해주세요." };
}

// ---------- 투표 ----------

export async function submitVote(roomId: string, userId: string, target: unknown): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "잠시 뒤 다시 시도해주세요." };

  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };
  if (room.status !== "voting") return { error: "지금은 투표 시간이 아니에요." };

  const deal = await getDeal(roomId);
  if (!deal) return { error: "카드를 찾을 수 없어요." };
  const seat = deal.seat_ids.indexOf(userId);
  if (seat < 0) return { error: "이 판의 참가자가 아니에요." };

  const n = deal.seat_ids.length;
  if (typeof target !== "number" || !Number.isInteger(target) || target < 0 || target >= n) {
    return { error: "없는 자리예요." };
  }
  if (target === seat) return { error: "자기 자신은 찍을 수 없어요." };

  const votes = deal.votes.slice();
  votes[seat] = target;
  const { error } = await supabase
    .from("onenight_deals")
    .update({ votes, updated_at: new Date().toISOString() })
    .eq("room_id", roomId);
  if (error) return { error: "잠시 뒤 다시 시도해주세요." };

  const voted = room.voted.includes(userId) ? room.voted : [...room.voted, userId];
  const updated = await updateRoom(room, { voted });
  return { room: updated ?? room };
}

/** 투표를 닫고 승패를 계산합니다. */
async function closeVoting(room: OneNightRoom): Promise<Outcome> {
  const deal = await getDeal(room.id);
  if (!deal || !deal.final_roles || !deal.final_center) return { error: "판 정보를 찾을 수 없어요." };

  const n = deal.seat_ids.length;
  const votes: (number | null)[] = Array.from({ length: n }, (_, i) => deal.votes[i] ?? null);
  const { tally, votedOut } = resolveVotes(votes, n);
  const { winners, reason } = judge(deal.final_roles, votedOut);

  const result: GameResult = {
    startRoles: deal.start_roles,
    finalRoles: deal.final_roles,
    center: deal.start_center,
    finalCenter: deal.final_center,
    votes,
    tally,
    dead: votedOut,
    winners,
    reason,
  };

  const updated = await updateRoom(room, {
    status: "finished",
    result,
    phase_started_at: new Date().toISOString(),
  });
  return updated ? { room: updated } : { error: "잠시 뒤 다시 시도해주세요." };
}

// ---------- 단계 넘기기 ----------

/**
 * 지금 단계를 넘겨야 하는지 보고, 넘겨야 하면 넘깁니다.
 *
 * 별도의 스케줄러 없이, 방을 보고 있는 사람의 폴링이 이 함수를 부릅니다
 * (랭킹 스냅샷과 같은 방식). 동시에 여러 명이 불러도 updateRoom의 version
 * 조건 때문에 한 번만 처리됩니다.
 */
export async function advancePhase(roomId: string, byUserId?: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "방을 찾을 수 없어요." };

  const seats = activePlayers(room);
  const left = remainingMs(room.phaseStartedAt, phaseSeconds(room), Date.now());
  const expired = left !== null && left <= 0 && Date.now() - new Date(room.phaseStartedAt!).getTime() > PHASE_GRACE_MS;

  switch (room.status) {
    case "night": {
      // 밤에 "골라야 하는 사람"만 기다립니다. 마을사람·불면증환자·동료가 있는
      // 늑대는 확인만 하면 되므로 안 냈다고 밤을 붙잡아 두지 않습니다.
      const deal = await getDeal(roomId);
      if (!deal) return { room };
      const wolves = deal.start_roles.filter((r) => r === "werewolf").length;
      const pending = deal.seat_ids.some((id, seat) => {
        const player = room.players.find((p) => p.id === id);
        if (!player || player.left) return false;
        const role = deal.start_roles[seat];
        if (!needsNightChoice(role, role === "werewolf" ? wolves - 1 : 0)) return false;
        return deal.night_actions[seat] == null;
      });
      if (!pending || expired) return closeNight(room);
      return { room };
    }
    case "day": {
      // 방장이 "투표 시작"을 누르거나 토론 시간이 끝나면 투표로 넘어갑니다.
      if (expired || byUserId === room.hostId) {
        const updated = await updateRoom(room, { status: "voting", phase_started_at: new Date().toISOString() });
        return updated ? { room: updated } : { room };
      }
      return { room };
    }
    case "voting": {
      if (seats.every((p) => room.voted.includes(p.id)) || expired) return closeVoting(room);
      return { room };
    }
    default:
      return { room };
  }
}

function phaseSeconds(room: OneNightRoom): number {
  if (room.status === "night") return room.settings.nightSec;
  if (room.status === "day") return room.settings.daySec;
  if (room.status === "voting") return room.settings.voteSec;
  return 0;
}
