import { getSupabase } from "./supabase";
import {
  MAX_IMAGE_BYTES,
  MAX_PLAYERS,
  MAX_TEXT_LENGTH,
  MIN_PLAYERS,
  activePlayers,
  albumIndexFor,
  isTurnExpired,
  totalTurnsFor,
  turnKind,
  type AlbumEntry,
  type EntryKind,
  type EntryStatus,
  type PhoneRoom,
  type RoomPlayer,
  type RoomSettings,
} from "./phoneMatch";

// 갈틱폰 서버 로직. 방 진행(턴·제출·공개 위치)은 phone_rooms에, 앨범의 칸은 phone_entries에 둡니다.
// 칸은 항상 "지금 봐도 되는 것"만 골라서 내려줍니다: 진행 중엔 내가 받은 앞 칸 하나, 공개 중엔 방장이 넘긴 데까지.

export { MIN_PLAYERS, MAX_PLAYERS } from "./phoneMatch";
export type { PhoneRoom, RoomPlayer, AlbumEntry } from "./phoneMatch";

/** 1시간 동안 아무 움직임이 없는 방은 상태와 무관하게 정리합니다(그림이 DB에 있어 오래 두지 않습니다).
 * 진행 중(playing)인 방도 포함합니다 — 정상 진행 중엔 매 턴 updated_at이 갱신되고,
 * 앨범을 보는 동안에도 방장이 넘길 때마다 갱신되므로, 1시간 멈춘 방은 버려진 방입니다. */
const STALE_ROOM_TTL_MS = 1 * 60 * 60 * 1000;

type RoomRow = {
  id: string;
  room_name: string;
  status: PhoneRoom["status"];
  host_id: string;
  players: RoomPlayer[];
  settings: RoomSettings;
  turn: number;
  total_turns: number;
  submitted: string[];
  reveal: { album: number; step: number };
  version: number;
  started_at: string | null;
  turn_started_at: string | null;
  created_at: string;
};

type EntryRow = {
  album_owner_id: string;
  turn: number;
  author_id: string;
  author_name: string;
  kind: EntryKind;
  text: string | null;
  image: string | null;
  status: EntryStatus;
};

function mapRow(row: RoomRow): PhoneRoom {
  return {
    id: row.id,
    roomName: row.room_name,
    status: row.status,
    hostId: row.host_id,
    players: Array.isArray(row.players) ? row.players : [],
    settings: row.settings ?? { writeSec: 40, drawSec: 90 },
    turn: row.turn,
    totalTurns: row.total_turns,
    submitted: Array.isArray(row.submitted) ? row.submitted : [],
    reveal: row.reveal ?? { album: 0, step: 0 },
    version: row.version,
    startedAt: row.started_at,
    turnStartedAt: row.turn_started_at,
    createdAt: row.created_at,
  };
}

function mapEntry(row: EntryRow): AlbumEntry {
  return { turn: row.turn, kind: row.kind, authorId: row.author_id, authorName: row.author_name, text: row.text, image: row.image, status: row.status };
}

type Outcome = { room: PhoneRoom } | { error: string };

// ---------- 조회 ----------

async function cleanupStaleRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - STALE_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("phone_rooms").delete().lt("updated_at", cutoff);
  if (error) console.error("phone cleanup error:", error);
}

export async function listRooms(): Promise<PhoneRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  await cleanupStaleRooms();
  const { data, error } = await supabase.from("phone_rooms").select().order("created_at", { ascending: false }).limit(30);
  if (error || !data) return [];
  return (data as RoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<PhoneRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("phone_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as RoomRow);
}

/** version 조건을 붙인 갱신. 다른 요청이 먼저 처리됐으면 null. */
async function updateRoom(room: PhoneRoom, patch: Record<string, unknown>): Promise<PhoneRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("phone_rooms")
    .update({ ...patch, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq("id", room.id)
    .eq("version", room.version)
    .select()
    .maybeSingle();
  if (error) {
    console.error("phone updateRoom error:", error);
    return null;
  }
  return data ? mapRow(data as RoomRow) : null;
}

// ---------- 방 생성·참여 ----------

export async function createRoom(userId: string, userName: string, avatarUrl: string | undefined, roomName: string | undefined, settings: Partial<RoomSettings>): Promise<PhoneRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const trimmedName = roomName?.trim().slice(0, 40);
  const writeSec = Math.min(300, Math.max(10, Math.round(Number(settings.writeSec) || 40)));
  const drawSec = Math.min(600, Math.max(15, Math.round(Number(settings.drawSec) || 90)));
  const { data, error } = await supabase
    .from("phone_rooms")
    .insert({
      room_name: trimmedName || `${userName}님의 방`,
      host_id: userId,
      players: [{ id: userId, name: userName, avatarUrl, left: false }],
      settings: { writeSec, drawSec },
    })
    .select()
    .single();
  if (error || !data) {
    console.error("phone createRoom error:", error);
    return null;
  }
  return mapRow(data as RoomRow);
}

export async function joinRoom(roomId: string, userId: string, userName: string, avatarUrl?: string): Promise<PhoneRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.players.some((p) => p.id === userId)) return room;
  if (room.status !== "waiting") return { error: "이미 시작된 방이에요. 다음 판부터 참여할 수 있어요." };
  if (room.players.length >= MAX_PLAYERS) return { error: `자리가 다 찼어요(최대 ${MAX_PLAYERS}명).` };

  const updated = await updateRoom(room, { players: [...room.players, { id: userId, name: userName, avatarUrl, left: false }] });
  return updated ?? { error: "잠시 뒤 다시 시도해주세요." };
}

/** 방장이 방을 없앱니다(상태 무관). 칸·채팅은 함께 삭제됩니다. */
export async function closeRoom(roomId: string, hostId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };
  const room = await getRoom(roomId);
  if (!room) return { ok: true }; // 이미 없음
  if (room.hostId !== hostId) return { error: "방장만 방을 없앨 수 있어요." };
  const { error } = await supabase.from("phone_rooms").delete().eq("id", roomId);
  if (error) {
    console.error("phone closeRoom error:", error);
    return { error: "방을 없애지 못했어요." };
  }
  return { ok: true };
}

/** 대기 중인 방에서 방장이 자리를 비운 사람을 내보냅니다. */
export async function kickPlayer(roomId: string, hostId: string, targetId: string): Promise<PhoneRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== hostId) return { error: "방장만 내보낼 수 있어요." };
  if (room.status !== "waiting") return { error: "게임이 시작된 뒤에는 내보낼 수 없어요." };
  if (targetId === hostId) return { error: "자기 자신은 내보낼 수 없어요." };
  if (!room.players.some((p) => p.id === targetId)) return { error: "방에 없는 사람이에요." };
  const updated = await updateRoom(room, { players: room.players.filter((p) => p.id !== targetId) });
  return updated ?? { error: "잠시 뒤 다시 시도해주세요." };
}

/** 방장이 시작: 참여자 순서를 고정하고 1턴(글)을 엽니다. */
export async function startGame(roomId: string, userId: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== userId) return { error: "방장만 시작할 수 있어요." };
  if (room.status !== "waiting") return { error: "이미 시작했어요." };
  const players = activePlayers(room);
  if (players.length < MIN_PLAYERS) return { error: `${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요.` };

  const now = new Date().toISOString();
  const updated = await updateRoom(room, {
    status: "playing",
    players,
    turn: 1,
    total_turns: totalTurnsFor(players.length),
    submitted: [],
    reveal: { album: 0, step: 0 },
    started_at: now,
    turn_started_at: now,
  });
  return updated ? { room: updated } : { error: "이미 다른 상태로 바뀌었어요." };
}

/** 공개가 끝난 뒤 방장이 "한 판 더": 칸을 비우고 대기 상태로 돌아갑니다(나간 사람은 빠집니다). */
export async function restartGame(roomId: string, userId: string): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== userId) return { error: "방장만 다시 시작할 수 있어요." };
  if (room.status !== "presenting") return { error: "앨범 공개가 끝난 뒤에 다시 시작할 수 있어요." };

  const updated = await updateRoom(room, {
    status: "waiting",
    players: activePlayers(room),
    turn: 0,
    total_turns: 0,
    submitted: [],
    reveal: { album: 0, step: 0 },
    started_at: null,
    turn_started_at: null,
  });
  if (!updated) return { error: "이미 다른 상태로 바뀌었어요." };
  const { error } = await supabase.from("phone_entries").delete().eq("room_id", roomId);
  if (error) console.error("phone restart(entries) error:", error);
  return { room: updated };
}

// ---------- 턴 진행 ----------

async function getEntry(roomId: string, albumOwnerId: string, turn: number): Promise<AlbumEntry | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("phone_entries")
    .select("album_owner_id, turn, author_id, author_name, kind, text, image, status")
    .eq("room_id", roomId)
    .eq("album_owner_id", albumOwnerId)
    .eq("turn", turn)
    .maybeSingle<EntryRow>();
  return data ? mapEntry(data) : null;
}

/** 진행 중에 플레이어 한 명이 받는 과제: 이번 턴의 종류와 "앞 칸" 하나. 다른 칸은 절대 내려가지 않습니다. */
export type PlayerTask = {
  turn: number;
  totalTurns: number;
  kind: EntryKind;
  albumOwnerName: string;
  /** 1턴(첫 문장)은 null. */
  previous: AlbumEntry | null;
  submitted: boolean;
  /** 이미 제출한 내 칸(고치기용). */
  mine: AlbumEntry | null;
};

export async function getTask(room: PhoneRoom, userId: string): Promise<PlayerTask | null> {
  if (room.status !== "playing") return null;
  const index = room.players.findIndex((p) => p.id === userId);
  if (index < 0 || room.players[index].left) return null;
  const albumIndex = albumIndexFor(index, room.turn, room.players.length);
  const owner = room.players[albumIndex];
  const previous = room.turn > 1 ? await getEntry(room.id, owner.id, room.turn - 1) : null;
  const mine = room.submitted.includes(userId) ? await getEntry(room.id, owner.id, room.turn) : null;
  return {
    turn: room.turn,
    totalTurns: room.totalTurns,
    kind: turnKind(room.turn),
    albumOwnerName: owner.name,
    previous: previous ? { ...previous, authorId: "", authorName: "" } : null, // 익명: 작성자는 공개 때까지 숨김
    submitted: room.submitted.includes(userId),
    mine,
  };
}

function validateText(raw: unknown): string | { error: string } {
  if (typeof raw !== "string") return { error: "문장을 입력해주세요." };
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { error: "문장을 입력해주세요." };
  if (text.length > MAX_TEXT_LENGTH) return { error: `문장은 ${MAX_TEXT_LENGTH}자까지만 쓸 수 있어요.` };
  return text;
}

function validateImage(raw: unknown): string | { error: string } {
  if (typeof raw !== "string" || !raw.startsWith("data:image/png;base64,")) return { error: "그림 형식이 올바르지 않아요." };
  // base64는 원본의 약 4/3 크기
  if (raw.length > MAX_IMAGE_BYTES * 1.4) return { error: "그림 용량이 너무 커요." };
  return raw;
}

/** 이번 턴 내 칸을 제출합니다(마감 뒤 잠깐은 받아주고, 전원 제출이면 바로 다음 턴으로). */
export async function submitEntry(roomId: string, userId: string, body: { text?: unknown; image?: unknown }): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  const index = room.players.findIndex((p) => p.id === userId && !p.left);
  if (index < 0) return { error: "참여자만 제출할 수 있어요." };
  if (isTurnExpired(room, Date.now())) return { error: "이번 턴 시간이 끝났어요." };

  const kind = turnKind(room.turn);
  const me = room.players[index];
  const owner = room.players[albumIndexFor(index, room.turn, room.players.length)];
  let text: string | null = null;
  let image: string | null = null;
  if (kind === "text") {
    const v = validateText(body.text);
    if (typeof v !== "string") return v;
    text = v;
  } else {
    const v = validateImage(body.image);
    if (typeof v !== "string") return v;
    image = v;
  }

  const { error } = await supabase.from("phone_entries").upsert(
    {
      room_id: roomId,
      album_owner_id: owner.id,
      turn: room.turn,
      author_id: me.id,
      author_name: me.name,
      kind,
      text,
      image,
      status: "ok",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id,album_owner_id,turn" },
  );
  if (error) {
    console.error("phone submit error:", error);
    return { error: "저장하지 못했어요. 다시 시도해주세요." };
  }

  // 제출자 목록 갱신(동시 제출 경쟁은 version으로 잡고 몇 번 재시도)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fresh = attempt === 0 ? room : await getRoom(roomId);
    if (!fresh || fresh.status !== "playing" || fresh.turn !== room.turn) return fresh ? { room: fresh } : { error: "방을 찾을 수 없어요." };
    const submitted = fresh.submitted.includes(userId) ? fresh.submitted : [...fresh.submitted, userId];
    const everyone = activePlayers(fresh).every((p) => submitted.includes(p.id));
    const updated = everyone ? await advanceTurn({ ...fresh, submitted }) : await updateRoom(fresh, { submitted });
    if (updated) return { room: updated };
  }
  return { error: "다른 요청과 겹쳤어요. 다시 시도해주세요." };
}

/** 제한 시간 초과: 누구든 알려오면 서버가 시각을 다시 확인하고 미제출 칸을 채운 뒤 다음 턴으로 넘깁니다. */
export async function timeoutTurn(roomId: string, userId: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (!room.players.some((p) => p.id === userId)) return { error: "참여자만 할 수 있어요." };
  if (room.status !== "playing") return { room };
  if (!isTurnExpired(room, Date.now())) return { error: "아직 시간이 남아 있어요." };
  const updated = await advanceTurn(room);
  return updated ? { room: updated } : { error: "다른 요청이 먼저 처리됐어요." };
}

/** 이번 턴에 비어 있는 칸을 채웁니다(나간 사람 → left, 안 낸 사람 → timeout). */
async function fillMissingEntries(room: PhoneRoom): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const n = room.players.length;
  const kind = turnKind(room.turn);
  const { data } = await supabase.from("phone_entries").select("album_owner_id").eq("room_id", room.id).eq("turn", room.turn);
  const have = new Set(((data ?? []) as { album_owner_id: string }[]).map((r) => r.album_owner_id));
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const owner = room.players[albumIndexFor(i, room.turn, n)];
    if (have.has(owner.id)) continue;
    const author = room.players[i];
    rows.push({
      room_id: room.id,
      album_owner_id: owner.id,
      turn: room.turn,
      author_id: author.id,
      author_name: author.name,
      kind,
      text: null,
      image: null,
      status: author.left ? "left" : "timeout",
    });
  }
  if (rows.length === 0) return;
  const { error } = await supabase.from("phone_entries").upsert(rows, { onConflict: "room_id,album_owner_id,turn", ignoreDuplicates: true });
  if (error) console.error("phone fillMissing error:", error);
}

/** 다음 턴으로. 마지막 턴이었으면 공개 단계로 넘어갑니다. */
async function advanceTurn(room: PhoneRoom): Promise<PhoneRoom | null> {
  await fillMissingEntries(room);
  if (room.turn >= room.totalTurns) {
    return updateRoom(room, { status: "presenting", submitted: [], reveal: { album: 0, step: 0 }, turn_started_at: null });
  }
  return updateRoom(room, { turn: room.turn + 1, submitted: [], turn_started_at: new Date().toISOString() });
}

/** 나가기: 대기 중이면 자리 비우기, 진행 중이면 자리 비움 처리(3명 미만이 되면 그때까지의 앨범으로 공개 단계로). */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const room = await getRoom(roomId);
  if (!room || !room.players.some((p) => p.id === userId && !p.left)) return;

  if (room.status === "waiting") {
    const remaining = room.players.filter((p) => p.id !== userId);
    if (remaining.length === 0) {
      await supabase.from("phone_rooms").delete().eq("id", roomId);
      return;
    }
    await updateRoom(room, { players: remaining, host_id: room.hostId === userId ? remaining[0].id : room.hostId });
    return;
  }

  const players = room.players.map((p) => (p.id === userId ? { ...p, left: true } : p));
  const remaining = players.filter((p) => !p.left);
  const hostId = room.hostId === userId && remaining.length > 0 ? remaining[0].id : room.hostId;

  // 마지막 앉은 사람이 나가면 방을 바로 지웁니다 — 아무도 안 남은 앨범은 다시 볼 사람도 없습니다.
  // (탭을 그냥 닫은 사람은 감지할 수 없으므로, 그런 방은 위의 24시간 청소가 처리합니다.)
  if (remaining.length === 0) {
    await supabase.from("phone_rooms").delete().eq("id", roomId);
    return;
  }

  if (room.status === "presenting") {
    await updateRoom(room, { players, host_id: hostId });
    return;
  }

  // playing
  const withPlayers = { ...room, players };
  if (remaining.length < MIN_PLAYERS) {
    await fillMissingEntries(withPlayers);
    await updateRoom(room, { players, host_id: hostId, status: "presenting", submitted: [], reveal: { album: 0, step: 0 }, turn_started_at: null });
    return;
  }
  const everyone = remaining.every((p) => room.submitted.includes(p.id));
  if (everyone) {
    await fillMissingEntries(withPlayers);
    if (room.turn >= room.totalTurns) {
      await updateRoom(room, { players, host_id: hostId, status: "presenting", submitted: [], reveal: { album: 0, step: 0 }, turn_started_at: null });
    } else {
      await updateRoom(room, { players, host_id: hostId, turn: room.turn + 1, submitted: [], turn_started_at: new Date().toISOString() });
    }
    return;
  }
  await updateRoom(room, { players, host_id: hostId });
}

// ---------- 앨범 공개 ----------

export type AlbumSummary = { index: number; ownerId: string; ownerName: string; length: number; revealed: number };

async function albumLengths(roomId: string): Promise<Map<string, number>> {
  const supabase = getSupabase();
  const lengths = new Map<string, number>();
  if (!supabase) return lengths;
  const { data } = await supabase.from("phone_entries").select("album_owner_id").eq("room_id", roomId);
  for (const row of (data ?? []) as { album_owner_id: string }[]) lengths.set(row.album_owner_id, (lengths.get(row.album_owner_id) ?? 0) + 1);
  return lengths;
}

function revealedCount(room: PhoneRoom, albumIndex: number, length: number): number {
  if (room.status !== "presenting") return 0;
  if (albumIndex < room.reveal.album) return length;
  if (albumIndex === room.reveal.album) return Math.min(length, room.reveal.step);
  return 0;
}

export async function getAlbumSummaries(room: PhoneRoom): Promise<AlbumSummary[]> {
  if (room.status !== "presenting") return [];
  const lengths = await albumLengths(room.id);
  return room.players.map((p, index) => {
    const length = lengths.get(p.id) ?? 0;
    return { index, ownerId: p.id, ownerName: p.name, length, revealed: revealedCount(room, index, length) };
  });
}

/** 앨범 하나의 칸들(턴 순). 기본은 방장이 넘긴 데까지, full이면 전체 —
 * 공개 단계에서는 방장이 자리를 비워도 각자 모든 앨범을 끝까지 볼 수 있어야 합니다. */
export async function getRevealedAlbum(room: PhoneRoom, albumIndex: number, full = false): Promise<{ owner: RoomPlayer; entries: AlbumEntry[]; length: number } | null> {
  const supabase = getSupabase();
  if (!supabase || room.status !== "presenting") return null;
  const owner = room.players[albumIndex];
  if (!owner) return null;
  const { data } = await supabase
    .from("phone_entries")
    .select("album_owner_id, turn, author_id, author_name, kind, text, image, status")
    .eq("room_id", room.id)
    .eq("album_owner_id", owner.id)
    .order("turn", { ascending: true });
  const all = ((data ?? []) as EntryRow[]).map(mapEntry);
  const count = full ? all.length : revealedCount(room, albumIndex, all.length);
  return { owner, entries: all.slice(0, count), length: all.length };
}

/** 방장이 공개 위치를 옮깁니다. next/prev는 앨범 경계를 넘어갑니다. */
export async function setReveal(roomId: string, userId: string, action: { type: "next" } | { type: "prev" } | { type: "album"; album: number } | { type: "all" }): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.hostId !== userId) return { error: "방장만 넘길 수 있어요." };
  if (room.status !== "presenting") return { error: "앨범 공개 단계가 아니에요." };

  const lengths = await albumLengths(roomId);
  const lengthOf = (i: number) => lengths.get(room.players[i]?.id ?? "") ?? 0;
  const n = room.players.length;
  let { album, step } = room.reveal;

  if (action.type === "album") {
    if (action.album < 0 || action.album >= n) return { error: "없는 앨범이에요." };
    album = action.album;
    step = 0;
  } else if (action.type === "all") {
    step = lengthOf(album);
  } else if (action.type === "next") {
    if (step < lengthOf(album)) step += 1;
    else if (album < n - 1) {
      album += 1;
      step = 0;
    } else return { room };
  } else {
    if (step > 0) step -= 1;
    else if (album > 0) {
      album -= 1;
      step = lengthOf(album);
    } else return { room };
  }
  const updated = await updateRoom(room, { reveal: { album, step } });
  return updated ? { room: updated } : { error: "다른 요청이 먼저 처리됐어요." };
}
