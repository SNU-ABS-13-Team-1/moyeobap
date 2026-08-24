import { getSupabase } from "./supabase";
import { currentWeekKey } from "./gameWeek";
import { HAND_SIZE, arrangeSet, createDeck, handPenalty, sortTiles, validateTurn, type Tile } from "./rummy";
import {
  MAX_PLAYERS,
  MAX_TIMEOUT_STRIKES,
  MIN_PLAYERS,
  activePlayers,
  currentPlayer,
  isTurnExpired,
  tileFromId,
  type EndReason,
  type RoomPlayer,
  type RoomStatus,
  type RummyRoom,
} from "./rummyMatch";

// 타입·상수·순수 함수는 rummyMatch.ts에 있고, API 라우트 편의상 여기서 다시 내보냅니다.
export { END_REASON_LABEL, MAX_PLAYERS, MAX_TIMEOUT_STRIKES, MIN_PLAYERS, TURN_GRACE_MS, activePlayers, currentPlayer, isTurnExpired, tileFromId } from "./rummyMatch";
export type { EndReason, RoomPlayer, RoomStatus, RummyRoom } from "./rummyMatch";

// 루미큐브 온라인 대전(2~4명)의 서버 로직. 손패·더미는 서버 전용 표에 있고,
// 클라이언트는 턴 종료 때 "최종 테이블"만 보냅니다. 서버가 자기 손패 기준으로 규칙을 다시 검증합니다.

/** 끝난 방은 하루 지나면 정리합니다(전적·랭킹은 별도 표라 남습니다). */
const FINISHED_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

type RoomRow = {
  id: string;
  room_name: string;
  status: RoomStatus;
  host_id: string;
  players: RoomPlayer[];
  turn_index: number;
  table_sets: Tile[][];
  deck_count: number;
  pass_streak: number;
  winner_id: string | null;
  end_reason: EndReason;
  turn_limit_sec: number;
  version: number;
  started_at: string | null;
  turn_started_at: string | null;
  created_at: string;
};

function mapRow(row: RoomRow): RummyRoom {
  return {
    id: row.id,
    roomName: row.room_name,
    status: row.status,
    hostId: row.host_id,
    players: Array.isArray(row.players) ? row.players : [],
    turnIndex: row.turn_index,
    table: Array.isArray(row.table_sets) ? row.table_sets : [],
    deckCount: row.deck_count,
    passStreak: row.pass_streak,
    winnerId: row.winner_id,
    endReason: row.end_reason,
    turnLimitSec: row.turn_limit_sec,
    version: row.version,
    startedAt: row.started_at,
    turnStartedAt: row.turn_started_at,
    createdAt: row.created_at,
  };
}

function nextTurnIndex(room: RummyRoom, from: number): number {
  const n = room.players.length;
  for (let step = 1; step <= n; step += 1) {
    const idx = (from + step) % n;
    if (!room.players[idx].left) return idx;
  }
  return from;
}

// ---------- 조회 ----------

async function cleanupOldFinishedRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - FINISHED_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("rummy_rooms").delete().eq("status", "finished").lt("updated_at", cutoff);
  if (error) console.error("rummy cleanup error:", error);
}


export async function listRooms(): Promise<RummyRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  await cleanupOldFinishedRooms();
  const { data, error } = await supabase
    .from("rummy_rooms")
    .select()
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return (data as RoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<RummyRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("rummy_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as RoomRow);
}

export async function getHand(roomId: string, userId: string): Promise<Tile[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("rummy_hands").select("tiles").eq("room_id", roomId).eq("user_id", userId).maybeSingle<{ tiles: Tile[] }>();
  if (error || !data) return null;
  return Array.isArray(data.tiles) ? data.tiles : [];
}

/** version 조건을 붙인 갱신. 다른 요청이 먼저 처리됐으면 null. */
async function updateRoom(room: RummyRoom, patch: Record<string, unknown>): Promise<RummyRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("rummy_rooms")
    .update({ ...patch, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq("id", room.id)
    .eq("version", room.version)
    .select()
    .maybeSingle();
  if (error) {
    console.error("rummy updateRoom error:", error);
    return null;
  }
  return data ? mapRow(data as RoomRow) : null;
}

// ---------- 방 생성·참여 ----------

export async function createRoom(userId: string, userName: string, roomName?: string, turnLimitSec = 90): Promise<RummyRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const trimmedName = roomName?.trim().slice(0, 40);
  const limit = Math.min(600, Math.max(30, Math.round(turnLimitSec)));
  const { data, error } = await supabase
    .from("rummy_rooms")
    .insert({
      room_name: trimmedName || `${userName}님의 방`,
      host_id: userId,
      players: [{ id: userId, name: userName, melded: false, tileCount: 0, left: false }],
      turn_limit_sec: limit,
    })
    .select()
    .single();
  if (error || !data) {
    console.error("rummy createRoom error:", error);
    return null;
  }
  return mapRow(data as RoomRow);
}

export async function joinRoom(roomId: string, userId: string, userName: string): Promise<RummyRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.players.some((p) => p.id === userId)) return room;
  if (room.status !== "waiting") return { error: "이미 시작된 방이에요. 관전은 할 수 있어요." };
  if (room.players.length >= MAX_PLAYERS) return { error: "자리가 다 찼어요(최대 4명)." };

  const updated = await updateRoom(room, {
    players: [...room.players, { id: userId, name: userName, melded: false, tileCount: 0, left: false }],
  });
  return updated ?? { error: "잠시 뒤 다시 시도해주세요." };
}

/** 대기 중인 방에서 방장이 자리를 비운 사람을 내보냅니다(게임 시작 전에만). */
export async function kickPlayer(roomId: string, hostId: string, targetId: string): Promise<RummyRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== hostId) return { error: "방장만 내보낼 수 있어요." };
  if (room.status !== "waiting") return { error: "게임이 시작된 뒤에는 내보낼 수 없어요." };
  if (targetId === hostId) return { error: "자기 자신은 내보낼 수 없어요." };
  if (!room.players.some((p) => p.id === targetId)) return { error: "방에 없는 사람이에요." };
  const updated = await updateRoom(room, { players: room.players.filter((p) => p.id !== targetId) });
  return updated ?? { error: "잠시 뒤 다시 시도해주세요." };
}

/** 방장이 시작: 타일을 섞어 나눠주고 무작위로 선을 정합니다. */
export async function startGame(roomId: string, userId: string): Promise<RummyRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== userId) return { error: "방장만 시작할 수 있어요." };
  if (room.status !== "waiting") return { error: "이미 시작했어요." };
  if (room.players.length < MIN_PLAYERS) return { error: "2명 이상 모여야 시작할 수 있어요." };
  return dealAndStart(room);
}

async function dealAndStart(room: RummyRoom): Promise<RummyRoom | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const players = room.players.filter((p) => !p.left);
  let deck = createDeck();
  const hands: { room_id: string; user_id: string; tiles: Tile[]; updated_at: string }[] = [];
  const now = new Date().toISOString();
  for (const p of players) {
    hands.push({ room_id: room.id, user_id: p.id, tiles: sortTiles(deck.slice(0, HAND_SIZE), "color"), updated_at: now });
    deck = deck.slice(HAND_SIZE);
  }

  const { error: handError } = await supabase.from("rummy_hands").upsert(hands);
  if (handError) {
    console.error("rummy deal(hands) error:", handError);
    return { error: "타일을 나눠주지 못했어요." };
  }
  const { error: deckError } = await supabase.from("rummy_decks").upsert({ room_id: room.id, tiles: deck, updated_at: now });
  if (deckError) {
    console.error("rummy deal(deck) error:", deckError);
    return { error: "타일 더미를 만들지 못했어요." };
  }

  const first = Math.floor(Math.random() * players.length);
  const updated = await updateRoom(room, {
    status: "playing",
    players: players.map((p) => ({ id: p.id, name: p.name, melded: false, tileCount: HAND_SIZE, left: false })),
    turn_index: first,
    table_sets: [],
    deck_count: deck.length,
    pass_streak: 0,
    winner_id: null,
    end_reason: null,
    started_at: now,
    turn_started_at: now,
  });
  return updated ?? { error: "이미 다른 상태로 바뀌었어요." };
}

/** 끝난 방에서 방장이 같은 멤버로 다시 시작합니다. */
export async function restartGame(roomId: string, userId: string): Promise<RummyRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== userId) return { error: "방장만 다시 시작할 수 있어요." };
  if (room.status !== "finished") return { error: "끝난 방에서만 다시 시작할 수 있어요." };
  if (activePlayers(room).length < MIN_PLAYERS) return { error: "남은 사람이 2명 미만이에요." };
  return dealAndStart(room);
}

// ---------- 턴 진행 ----------

type Outcome = { room: RummyRoom } | { error: string };

async function saveHand(roomId: string, userId: string, tiles: Tile[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("rummy_hands").upsert({ room_id: roomId, user_id: userId, tiles, updated_at: new Date().toISOString() });
  if (error) console.error("rummy saveHand error:", error);
  return !error;
}

async function getDeck(roomId: string): Promise<Tile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("rummy_decks").select("tiles").eq("room_id", roomId).maybeSingle<{ tiles: Tile[] }>();
  return data && Array.isArray(data.tiles) ? data.tiles : [];
}

async function saveDeck(roomId: string, tiles: Tile[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("rummy_decks").upsert({ room_id: roomId, tiles, updated_at: new Date().toISOString() });
  if (error) console.error("rummy saveDeck error:", error);
  return !error;
}

/** 턴 종료: 클라이언트가 보낸 최종 테이블을 서버 손패 기준으로 검증하고 반영합니다. */
export async function submitTurn(roomId: string, userId: string, rawTable: unknown): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  const me = currentPlayer(room);
  if (!me || me.id !== userId) return { error: "내 차례가 아니에요." };

  // 1) 타일을 id로 복원(위조 방지) + 같은 타일이 두 번 들어오지 않았는지
  if (!Array.isArray(rawTable)) return { error: "잘못된 요청이에요." };
  const table: Tile[][] = [];
  const seen = new Set<string>();
  for (const rawSet of rawTable) {
    if (!Array.isArray(rawSet)) return { error: "잘못된 요청이에요." };
    const set: Tile[] = [];
    for (const raw of rawSet) {
      const id = typeof raw === "string" ? raw : typeof raw?.id === "string" ? raw.id : null;
      const tile = id ? tileFromId(id) : null;
      if (!tile || seen.has(tile.id)) return { error: "타일 정보가 올바르지 않아요." };
      seen.add(tile.id);
      set.push(tile);
    }
    if (set.length > 0) table.push(set);
  }

  // 2) 테이블에 있던 타일 + 내 손패 타일만 쓸 수 있고, 테이블에 있던 타일은 하나도 사라지면 안 됨
  const hand = (await getHand(roomId, userId)) ?? [];
  const handIds = new Set(hand.map((t) => t.id));
  const beforeIds = new Set(room.table.flat().map((t) => t.id));
  for (const id of seen) if (!handIds.has(id) && !beforeIds.has(id)) return { error: "테이블에 없던 타일이 섞여 있어요." };
  for (const id of beforeIds) if (!seen.has(id)) return { error: "테이블의 타일을 손으로 가져올 수 없어요." };

  // 3) 규칙 검증(첫 등록 30점, 세트 유효성, 1장 이상 냄)
  const result = validateTurn({ before: room.table, after: table, handBefore: hand, melded: me.melded });
  if (!result.ok) return { error: result.reason };

  const nextHand = hand.filter((t) => !seen.has(t.id));
  if (!(await saveHand(roomId, userId, nextHand))) return { error: "손패를 저장하지 못했어요." };

  const players = room.players.map((p) => (p.id === userId ? { ...p, melded: true, tileCount: nextHand.length, timeouts: 0 } : p));
  if (nextHand.length === 0) {
    return finishGame({ ...room, players, table: table.map(arrangeSet) }, userId, "empty_hand");
  }

  const now = new Date().toISOString();
  const updated = await updateRoom(room, {
    players,
    table_sets: table.map(arrangeSet),
    pass_streak: 0,
    turn_index: nextTurnIndex({ ...room, players }, room.turnIndex),
    turn_started_at: now,
  });
  if (!updated) {
    // 방 갱신이 실패하면 손패도 되돌립니다.
    await saveHand(roomId, userId, hand);
    return { error: "다른 요청이 먼저 처리됐어요. 다시 시도해주세요." };
  }
  return { room: updated };
}

/** 타일을 뽑고 넘기기(더미가 비었으면 그냥 넘김). 모두 넘기면 벌점이 가장 적은 사람이 이깁니다. */
export async function drawAndPass(roomId: string, userId: string, opts: { byTimeout?: boolean } = {}): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  const me = currentPlayer(room);
  if (!me) return { error: "차례 정보를 찾을 수 없어요." };
  if (!opts.byTimeout && me.id !== userId) return { error: "내 차례가 아니에요." };

  // 연속 시간 초과가 한도에 닿으면 자리를 비운 것으로 보고 자동 기권 처리합니다.
  const strikes = opts.byTimeout ? (me.timeouts ?? 0) + 1 : 0;
  if (opts.byTimeout && strikes >= MAX_TIMEOUT_STRIKES) {
    return resignPlayer(room, me.id);
  }

  const deck = await getDeck(roomId);
  let players = room.players.map((p) => (p.id === me.id ? { ...p, timeouts: strikes } : p));
  let passStreak = room.passStreak + 1;
  let deckCount = room.deckCount;

  if (deck.length > 0) {
    const [tile, ...rest] = deck;
    const hand = (await getHand(roomId, me.id)) ?? [];
    if (!(await saveHand(roomId, me.id, sortTiles([...hand, tile], "color")))) return { error: "타일을 뽑지 못했어요." };
    if (!(await saveDeck(roomId, rest))) return { error: "더미를 저장하지 못했어요." };
    deckCount = rest.length;
    passStreak = 0;
    players = players.map((p) => (p.id === me.id ? { ...p, tileCount: hand.length + 1 } : p));
  }

  const withPlayers = { ...room, players };
  if (deck.length === 0 && passStreak >= activePlayers(withPlayers).length) {
    return finishGame(withPlayers, null, "stuck");
  }

  const updated = await updateRoom(room, {
    players,
    deck_count: deckCount,
    pass_streak: passStreak,
    turn_index: nextTurnIndex(withPlayers, room.turnIndex),
    turn_started_at: new Date().toISOString(),
  });
  return updated ? { room: updated } : { error: "다른 요청이 먼저 처리됐어요." };
}

/** 제한 시간 초과: 누구든 알려오면 서버가 시각을 다시 확인하고, 현재 차례 사람이 타일 1장을 뽑고 넘긴 것으로 처리합니다. */
export async function timeoutTurn(roomId: string, userId: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (!room.players.some((p) => p.id === userId)) return { error: "참여자만 할 수 있어요." };
  if (!isTurnExpired(room, Date.now())) return { error: "아직 시간이 남아 있어요." };
  return drawAndPass(roomId, userId, { byTimeout: true });
}

/** 나가기: 대기 중이면 자리 비우기(방장이면 다음 사람에게 방장 이전, 혼자면 방 삭제), 진행 중이면 기권. */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const room = await getRoom(roomId);
  if (!room || !room.players.some((p) => p.id === userId)) return;

  if (room.status === "waiting") {
    const remaining = room.players.filter((p) => p.id !== userId);
    if (remaining.length === 0) {
      await supabase.from("rummy_rooms").delete().eq("id", roomId);
      return;
    }
    await updateRoom(room, { players: remaining, host_id: room.hostId === userId ? remaining[0].id : room.hostId });
    return;
  }

  if (room.status === "playing") {
    await resignPlayer(room, userId);
  }
}

/** 진행 중 기권: 손패는 그대로 두고(정산 때 벌점으로 잡힘) 자리만 비웁니다. 1명만 남으면 그 사람 승리로 끝냅니다. */
async function resignPlayer(room: RummyRoom, userId: string): Promise<Outcome> {
  if (!room.players.some((p) => p.id === userId && !p.left)) return { error: "이미 나간 사람이에요." };
  const players = room.players.map((p) => (p.id === userId ? { ...p, left: true } : p));
  const withPlayers = { ...room, players };
  const remaining = activePlayers(withPlayers);
  if (remaining.length <= 1) {
    return finishGame(withPlayers, remaining[0]?.id ?? null, "others_left");
  }
  const wasMyTurn = currentPlayer(room)?.id === userId;
  const updated = await updateRoom(room, {
    players,
    host_id: room.hostId === userId ? remaining[0].id : room.hostId,
    turn_index: wasMyTurn ? nextTurnIndex(withPlayers, room.turnIndex) : room.turnIndex,
    turn_started_at: wasMyTurn ? new Date().toISOString() : room.turnStartedAt,
  });
  return updated ? { room: updated } : { error: "다른 요청이 먼저 처리됐어요." };
}

// ---------- 종료·기록 ----------

async function finishGame(room: RummyRoom, winnerId: string | null, reason: NonNullable<EndReason>): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data: handRows } = await supabase.from("rummy_hands").select("user_id, tiles").eq("room_id", room.id);
  const penaltyOf = new Map<string, number>();
  for (const row of (handRows ?? []) as { user_id: string; tiles: Tile[] }[]) penaltyOf.set(row.user_id, handPenalty(Array.isArray(row.tiles) ? row.tiles : []));

  const active = activePlayers(room);
  let winner = winnerId;
  if (!winner && reason === "stuck") {
    winner = [...active].sort((a, b) => (penaltyOf.get(a.id) ?? 0) - (penaltyOf.get(b.id) ?? 0))[0]?.id ?? null;
  }

  // 기권(나감)한 사람도 남은 손패 벌점을 그대로 잃습니다 — 질 것 같을 때 나가서 기록을 피하는 일이 없게.
  const players = room.players.map((p) => {
    const penalty = penaltyOf.get(p.id) ?? 0;
    const othersPenalty = room.players.filter((q) => q.id !== p.id).reduce((sum, q) => sum + (penaltyOf.get(q.id) ?? 0), 0);
    const score = p.id === winner ? othersPenalty - penalty : -penalty;
    return { ...p, penalty, score };
  });

  const updated = await updateRoom(room, {
    status: "finished",
    players,
    table_sets: room.table,
    winner_id: winner,
    end_reason: reason,
    turn_started_at: null,
  });
  if (!updated) return { error: "이미 다른 상태로 바뀌었어요." };

  const { error: matchError } = await supabase.from("rummy_matches").insert({
    room_id: room.id,
    players: players.map((p) => ({ id: p.id, name: p.name, penalty: p.penalty, score: p.score, left: p.left })),
    winner_id: winner,
    end_reason: reason,
    started_at: room.startedAt,
  });
  if (matchError) console.error("rummy match insert error:", matchError);

  for (const p of players) {
    const { data: rating } = await supabase
      .from("rummy_ratings")
      .select("games, wins, points")
      .eq("week_key", currentWeekKey())
      .eq("user_id", p.id)
      .maybeSingle<{ games: number; wins: number; points: number }>();
    const { error } = await supabase.from("rummy_ratings").upsert({
      week_key: currentWeekKey(),
      user_id: p.id,
      user_name: p.name,
      games: (rating?.games ?? 0) + 1,
      wins: (rating?.wins ?? 0) + (p.id === winner ? 1 : 0),
      points: (rating?.points ?? 0) + (p.score ?? 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week_key" });
    if (error) console.error("rummy rating upsert error:", error);
  }

  return { room: updated };
}

export type RummyRankingEntry = { userId: string; userName: string; games: number; wins: number; points: number };

export async function getRanking(limit = 20, weekKey = currentWeekKey()): Promise<RummyRankingEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rummy_ratings")
    .select("user_id, user_name, games, wins, points")
    .eq("week_key", weekKey)
    .order("points", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as { user_id: string; user_name: string; games: number; wins: number; points: number }[]).map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    games: r.games,
    wins: r.wins,
    points: r.points,
  }));
}

