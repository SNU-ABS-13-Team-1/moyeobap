import { getSupabase } from "./supabase";
import { recordMatchResult } from "./quoridorRanking";
import type { Mode } from "./quoridorMatch";
import {
  DEFAULT_TURN_LIMIT_SEC,
  mapRoomRow,
  planRestart,
  planResign,
  planStart,
  planTimeout,
  planTurn,
  updateRoomCas,
  type Plan,
  type QuoridorRoom,
  type QuoridorRoomRow,
} from "./quoridorRoom";

// 쿼리도 온라인 대전의 서버 로직. 규칙과 상태 전이는 quoridorRoom.ts(순수)에 있고,
// 여기서는 "행 읽기 → plan → version CAS 갱신 → (끝났으면) 랭킹 반영"만 합니다.

/** 1시간 동안 아무 움직임이 없는 방은 상태와 무관하게 정리합니다(전적·랭킹은 별도 표라 남습니다). */
const STALE_ROOM_TTL_MS = 1 * 60 * 60 * 1000;
const CAS_ATTEMPTS = 3;
const CONFLICT = "다른 요청이 먼저 처리됐어요. 다시 시도해주세요.";
const DB_ERROR = "서버가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해주세요.";

export type Outcome = { room: QuoridorRoom } | { error: string };

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- 조회 ----------

async function cleanupStaleRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - STALE_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("quoridor_rooms").delete().lt("updated_at", cutoff);
  if (error) console.error("quoridor cleanup error:", error);
}

export async function listRooms(): Promise<QuoridorRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  await cleanupStaleRooms();
  const { data, error } = await supabase
    .from("quoridor_rooms")
    .select()
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return (data as QuoridorRoomRow[]).map(mapRoomRow);
}

export async function getRoom(roomId: string): Promise<QuoridorRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("quoridor_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRoomRow(data as QuoridorRoomRow);
}

// ---------- 공통: plan을 CAS로 반영 ----------

/**
 * 최신 행으로 plan을 세우고 version 조건으로 반영합니다. 다른 요청에 지면 최신 행으로
 * 처음부터 다시 합니다(plan이 차례·시각을 다시 검증하므로 안전). 판이 끝났으면
 * CAS에서 이긴 이 요청만 랭킹을 반영하므로 중복이 없습니다.
 */
async function runPlan(roomId: string, plan: (room: QuoridorRoom, nowIso: string) => Plan): Promise<Outcome> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
    const room = await getRoom(roomId);
    if (!room) return { error: "존재하지 않는 방이에요." };
    const nowIso = new Date().toISOString();
    const result = plan(room, nowIso);
    if ("error" in result) return result;
    let updated: QuoridorRoom | null;
    try {
      updated = await updateRoomCas(supabase, room, result.patch, nowIso);
    } catch {
      return { error: DB_ERROR };
    }
    if (!updated) continue;
    if (result.finished && result.finished.winnerId) await recordMatchResult(updated);
    return { room: updated };
  }
  return { error: CONFLICT };
}

// ---------- 방 생성·참여 ----------

export async function createRoom(
  userId: string,
  userName: string,
  roomName: string | undefined,
  mode: Mode,
  turnLimitSec = DEFAULT_TURN_LIMIT_SEC,
): Promise<QuoridorRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const trimmedName = roomName?.trim().slice(0, 40);
  const limit = Math.min(600, Math.max(30, Math.round(turnLimitSec)));
  const { data, error } = await supabase
    .from("quoridor_rooms")
    .insert({
      room_name: trimmedName || `${userName}님의 방`,
      host_id: userId,
      mode,
      players: [{ id: userId, name: userName, seat: null, left: false, timeouts: 0 }],
      turn_limit_sec: limit,
    })
    .select()
    .single();
  if (error || !data) {
    console.error("quoridor createRoom error:", error);
    return null;
  }
  return mapRoomRow(data as QuoridorRoomRow);
}

export async function joinRoom(roomId: string, userId: string, userName: string): Promise<Outcome> {
  const room = await getRoom(roomId);
  if (room?.players.some((p) => p.id === userId && !p.left)) return { room };
  return runPlan(roomId, (current) => {
    if (current.status !== "waiting") return { error: "이미 시작된 방이에요. 관전은 할 수 있어요." };
    if (current.players.length >= current.mode) return { error: `자리가 다 찼어요(${current.mode}인전).` };
    return {
      patch: { players: [...current.players, { id: userId, name: userName, seat: null, left: false, timeouts: 0 }] },
      finished: null,
    };
  });
}

/** 대기 중인 방에서 방장이 자리를 비운 사람을 내보냅니다(게임 시작 전에만). */
export async function kickPlayer(roomId: string, hostId: string, targetId: string): Promise<Outcome> {
  return runPlan(roomId, (room) => {
    if (room.hostId !== hostId) return { error: "방장만 내보낼 수 있어요." };
    if (room.status !== "waiting") return { error: "게임이 시작된 뒤에는 내보낼 수 없어요." };
    if (targetId === hostId) return { error: "자기 자신은 내보낼 수 없어요." };
    if (!room.players.some((p) => p.id === targetId)) return { error: "방에 없는 사람이에요." };
    return { patch: { players: room.players.filter((p) => p.id !== targetId) }, finished: null };
  });
}

export async function startGame(roomId: string, userId: string): Promise<Outcome> {
  return runPlan(roomId, (room, nowIso) => planStart(room, userId, shuffle, nowIso));
}

/** 끝난 방에서 방장이 다시 시작합니다. 인원이 모자라면 대기 상태로 돌아가 새 사람을 받습니다. */
export async function restartGame(roomId: string, userId: string): Promise<Outcome> {
  return runPlan(roomId, (room, nowIso) => planRestart(room, userId, shuffle, nowIso));
}

// ---------- 턴 진행 ----------

export async function submitMove(roomId: string, userId: string, notation: unknown): Promise<Outcome> {
  return runPlan(roomId, (room, nowIso) => planTurn(room, userId, notation, nowIso));
}

/** 제한 시간 초과 신고: 서버가 시각을 다시 확인하고 현재 차례를 넘깁니다(연속 3회면 자동 기권). */
export async function timeoutTurn(roomId: string, userId: string): Promise<Outcome> {
  return runPlan(roomId, (room, nowIso) => planTimeout(room, userId, Date.now(), nowIso));
}

/**
 * 나가기: 대기 중이면 자리 비우기(방장이면 다음 사람에게 이전, 혼자면 방 삭제), 진행 중이면 기권,
 * 끝난 방이면 자리 비움 표시(마지막 사람이 나가면 방 삭제). 진행 중 기권도 runPlan을 거치므로
 * 나가기로 판이 끝나면 랭킹이 반영됩니다. 방이 지워졌거나 이미 나간 상태면 room은 null.
 * 갱신에 실패하면 error를 돌려줘 화면이 "나간 줄 아는데 서버엔 앉아 있는" 상태를 만들지 않습니다.
 */
export async function leaveRoom(roomId: string, userId: string): Promise<{ room: QuoridorRoom | null } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };
  const ALREADY_LEFT = "이미 나간 사람이에요.";
  let deleted = false;

  const result = await runPlan(roomId, (room, nowIso) => {
    if (!room.players.some((p) => p.id === userId && !p.left)) return { error: ALREADY_LEFT };
    if (room.status === "playing") return planResign(room, userId, nowIso);

    // waiting은 명단에서 빼고, finished는 자리 비움 표시만 합니다("다시 하기"에 끼지 않게).
    const players = room.status === "waiting"
      ? room.players.filter((p) => p.id !== userId)
      : room.players.map((p) => (p.id === userId ? { ...p, left: true } : p));
    const remaining = players.filter((p) => !p.left);
    if (remaining.length === 0) {
      deleted = true;
      return { error: "마지막 사람이 나감" };
    }
    return { patch: { players, host_id: room.hostId === userId ? remaining[0].id : room.hostId }, finished: null };
  });

  if (deleted) {
    const { error } = await supabase.from("quoridor_rooms").delete().eq("id", roomId);
    if (error) return { error: DB_ERROR };
    return { room: null };
  }
  if ("error" in result) {
    // 방이 없거나 이미 나간 상태면 나가기는 이미 이뤄진 것으로 봅니다.
    if (result.error === ALREADY_LEFT || result.error === "존재하지 않는 방이에요.") return { room: null };
    return result;
  }
  return result;
}
