import { getSupabase } from "./supabase";
import { recordMatchResult } from "./pongRanking";
import { TARGET_SCORE } from "./pongConstants";
import { resolveLeave, resolveSit } from "./gameSeats";

export type RoomStatus = "waiting" | "playing" | "finished";
export type Winner = "player1" | "player2" | null;

/** 하루 동안 아무 움직임이 없는 방은 상태와 무관하게 정리합니다(전적·랭킹은 별도 표라 남습니다).
 * 진행 중(playing)인 방도 포함합니다 — 정상 진행 중엔 득점마다 updated_at이 갱신되므로,
 * 24시간 멈춘 방은 전원이 창을 닫고 떠난 버려진 방입니다. */
const STALE_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export type PongRoom = {
  id: string;
  roomName: string;
  status: RoomStatus;
  player1Id: string | null;
  player1Name: string | null;
  player2Id: string | null;
  player2Name: string | null;
  score1: number;
  score2: number;
  winner: Winner;
  startedAt: string | null;
  createdAt: string;
};

type PongRoomRow = {
  id: string;
  room_name: string;
  status: RoomStatus;
  player1_id: string | null;
  player1_name: string | null;
  player2_id: string | null;
  player2_name: string | null;
  score1: number;
  score2: number;
  winner: Winner;
  started_at: string | null;
  created_at: string;
};

function mapRow(row: PongRoomRow): PongRoom {
  return {
    id: row.id,
    roomName: row.room_name,
    status: row.status,
    player1Id: row.player1_id,
    player1Name: row.player1_name,
    player2Id: row.player2_id,
    player2Name: row.player2_name,
    score1: row.score1,
    score2: row.score2,
    winner: row.winner,
    startedAt: row.started_at,
    createdAt: row.created_at,
  };
}

export async function createRoom(
  userId: string,
  userName: string,
  roomName?: string,
): Promise<PongRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const trimmedName = roomName?.trim().slice(0, 40);

  const { data, error } = await supabase
    .from("pong_rooms")
    .insert({
      player1_id: userId,
      player1_name: userName,
      room_name: trimmedName || `${userName}님의 방`,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createRoom error:", error);
    return null;
  }
  return mapRow(data as PongRoomRow);
}

async function cleanupStaleRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - STALE_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("pong_rooms").delete().lt("updated_at", cutoff);
  if (error) console.error("pong cleanupStaleRooms error:", error);
}

// 로비 목록: 대기 중이거나 이미 진행 중인 방을 모두 보여줘서, 빈 자리가
// 있으면 참여하고 없으면 관전으로 들어갈 수 있게 합니다.
export async function listRooms(): Promise<PongRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // 로비를 열 때마다 가볍게 청소합니다(조건에 맞는 행이 없으면 바로 끝).
  await cleanupStaleRooms();

  const { data, error } = await supabase
    .from("pong_rooms")
    .select()
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as PongRoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<PongRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.from("pong_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as PongRoomRow);
}

/**
 * 빈 자리에 앉습니다. 대기 중인 방이면 2P로 들어가 바로 시작하고, 상대가
 * 나가 자리가 빈 종료된 방이면 관전자가 그 자리에 앉습니다(다시 시작하기로
 * 새 판). 규칙은 오목·체스와 공유합니다(app/lib/gameSeats.ts).
 */
export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
): Promise<PongRoom | null | "full" | "self"> {
  const room = await getRoom(roomId);
  if (!room) return null;

  const outcome = resolveSit(
    { status: room.status, hostId: room.player1Id, guestId: room.player2Id },
    userId,
  );
  if (outcome.kind === "self") return "self";
  if (outcome.kind === "full") return "full";

  const supabase = getSupabase();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const seatColumn = outcome.seat === "host" ? "player1_id" : "player2_id";
  const seatUpdate =
    outcome.seat === "host"
      ? { player1_id: userId, player1_name: userName }
      : { player2_id: userId, player2_name: userName };
  const startUpdate = outcome.start ? { status: "playing" as const, started_at: now } : {};

  const { data, error } = await supabase
    .from("pong_rooms")
    .update({ ...seatUpdate, ...startUpdate, updated_at: now })
    .eq("id", roomId)
    .eq("status", room.status)
    .is(seatColumn, null)
    .select()
    .maybeSingle();

  if (error) {
    console.error("joinRoom error:", error);
    return null;
  }
  if (!data) return "full";
  return mapRow(data as PongRoomRow);
}

async function finishRoomWithWinner(room: PongRoom, winner: "player1" | "player2"): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("pong_rooms")
    .update({ status: "finished", winner, updated_at: new Date().toISOString() })
    .eq("id", room.id)
    .eq("status", "playing")
    .select()
    .maybeSingle();

  if (error) {
    console.error("finishRoomWithWinner error:", error);
    return;
  }
  if (!data) return; // 이미 다른 경로(정상 승부 등)로 종료된 방이에요.

  await recordMatchResult(mapRow(data as PongRoomRow), winner);
}

/**
 * "게임 나가기" 버튼의 서버 처리입니다. 사람이 한 명이라도 남아 있으면 방은
 * 사라지지 않고, 나간 사람의 자리만 비웁니다(app/lib/gameSeats.ts).
 * - playing: 기권으로 보고 상대가 승리합니다(점수는 그대로, 전적만 기록).
 *   그 뒤 자리를 비워 관전자가 앉을 수 있게 합니다.
 * - waiting/finished: 자리만 비우고, 남은 사람이 없으면 방을 지웁니다.
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const room = await getRoom(roomId);
  if (!room) return;

  const outcome = resolveLeave(
    { status: room.status, hostId: room.player1Id, guestId: room.player2Id },
    userId,
  );
  if (outcome.kind === "ignore") return;

  if (outcome.kind === "delete") {
    const otherColumn = room.player1Id === userId ? "player2_id" : "player1_id";
    const { error } = await supabase
      .from("pong_rooms")
      .delete()
      .eq("id", roomId)
      .eq("status", room.status)
      .is(otherColumn, null);
    if (error) console.error("leaveRoom(delete) error:", error);
    return;
  }

  // 기권은 자리를 비우기 전에 처리해야 전적에 두 사람 이름이 남습니다. 종료가
  // 반영되지 않았는데(=아직 playing) 자리를 비우면 남은 사람이 아무것도 할 수
  // 없는 방이 되므로, 그때는 자리를 그대로 둡니다.
  if (outcome.kind === "resign") {
    await finishRoomWithWinner(room, outcome.seat === "host" ? "player2" : "player1");
    const latest = await getRoom(roomId);
    if (!latest || latest.status === "playing") return;
  }

  const seatUpdate =
    outcome.seat === "host"
      ? { player1_id: null, player1_name: null }
      : { player2_id: null, player2_name: null };
  const seatColumn = outcome.seat === "host" ? "player1_id" : "player2_id";
  const { error } = await supabase
    .from("pong_rooms")
    .update({ ...seatUpdate, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq(seatColumn, userId);
  if (error) console.error("leaveRoom(vacate) error:", error);
}

/**
 * 상대가 대국 중 연결이 끊긴 뒤 일정 시간 돌아오지 않을 때, 남은 플레이어가
 * 직접 승리 처리할 수 있게 합니다. 서버는 참가자 여부와 playing 상태만
 * 검증하고, "상대가 일정 시간 부재했다"는 판단은 클라이언트(60초 타이머)를
 * 신뢰합니다. 오목과 동일한 트레이드오프입니다.
 */
/**
 * "기권하기": 대전 중인 사람이 그 판을 내줍니다. leaveRoom과 결과는 같지만
 * 자리를 그대로 둬서, 기권한 사람도 방에 남아 결과와 다시 하기를 봅니다.
 */
export async function resign(
  roomId: string,
  userId: string,
): Promise<{ room: PongRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 대전이 아니에요." };

  const isPlayer1 = room.player1Id === userId;
  const isPlayer2 = room.player2Id === userId;
  if (!isPlayer1 && !isPlayer2) return { error: "참여자만 기권할 수 있어요." };

  await finishRoomWithWinner(room, isPlayer1 ? "player2" : "player1");

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

export async function claimDisconnectWin(
  roomId: string,
  userId: string,
): Promise<{ room: PongRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const isPlayer1 = room.player1Id === userId;
  const isPlayer2 = room.player2Id === userId;
  if (!isPlayer1 && !isPlayer2) return { error: "참여자만 할 수 있어요." };

  const myColor: "player1" | "player2" = isPlayer1 ? "player1" : "player2";
  await finishRoomWithWinner(room, myColor);

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

/**
 * 종료된 대전을 같은 두 사람이 이어서 새로 시작합니다. player1/player2
 * 배정은 그대로 유지하고 점수만 초기화합니다.
 */
export async function restartRoom(
  roomId: string,
  userId: string,
): Promise<PongRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대전만 다시 시작할 수 있어요." };
  if (room.player1Id !== userId && room.player2Id !== userId) {
    return { error: "참여자만 다시 시작할 수 있어요." };
  }
  if (!room.player1Id || !room.player2Id) return { error: "상대가 없어서 다시 시작할 수 없어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("pong_rooms")
    .update({
      score1: 0,
      score2: 0,
      winner: null,
      status: "playing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "finished")
    .select()
    .maybeSingle();

  if (error) {
    console.error("restartRoom error:", error);
    return { error: "다시 시작하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as PongRoomRow);
}

/**
 * 방장(player1) 브라우저가 물리 시뮬레이션의 권위를 갖는 구조라, 공/패들의
 * 프레임 단위 위치까지는 이 서버가 검증하지 않습니다(Vercel 서버리스라
 * 60fps 게임 루프를 상시 돌릴 프로세스가 없습니다). 대신 실제로 신뢰가
 * 중요한 "점수"만큼은 이 함수가 진짜로 검증합니다: player1만 호출할 수
 * 있고, 한 번에 1점씩만 오르며, score1/score2에 낙관적 동시성을 걸어
 * 중복/경쟁 요청에도 이중 카운트되지 않습니다. player1이 물리 계산 자체를
 * 조작해 유리하게 만들 여지는 이 아키텍처의 근본적 한계이며, 완전히
 * 막으려면 전용 게임 서버가 필요합니다.
 */
export async function recordPoint(
  roomId: string,
  userId: string,
  scorer: "player1" | "player2",
): Promise<{ room: PongRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  if (room.player1Id !== userId) return { error: "방장만 점수를 기록할 수 있어요." };

  const nextScore1 = room.score1 + (scorer === "player1" ? 1 : 0);
  const nextScore2 = room.score2 + (scorer === "player2" ? 1 : 0);
  const finished = nextScore1 >= TARGET_SCORE || nextScore2 >= TARGET_SCORE;
  const winner: Winner = finished ? (nextScore1 >= TARGET_SCORE ? "player1" : "player2") : null;

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("pong_rooms")
    .update({
      score1: nextScore1,
      score2: nextScore2,
      status: finished ? "finished" : "playing",
      winner,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("score1", room.score1)
    .eq("score2", room.score2)
    .eq("status", "playing")
    .select()
    .maybeSingle();

  if (error) {
    console.error("recordPoint error:", error);
    return { error: "점수를 기록하지 못했어요." };
  }
  if (!data) {
    return { error: "다른 점수가 먼저 처리됐어요. 다시 시도해주세요." };
  }

  const updatedRoom = mapRow(data as PongRoomRow);
  if (finished && updatedRoom.winner) {
    await recordMatchResult(updatedRoom, updatedRoom.winner);
  }
  return { room: updatedRoom };
}
