import { getSupabase } from "./supabase";
import { recordChessMatchResult } from "./chessRanking";
import {
  applyChessMove,
  banksAfterMove,
  initialBankMs,
  isClockExpired,
  swappedColors,
  type ChessColor,
  type ChessEndReason,
  type ChessWinner,
  type ClockState,
  type TimeControl,
} from "./chessMatch";

// 실시간 체스 대전의 서버 로직입니다. 오목(app/lib/omok.ts)과 같은 흐름이고,
// 보드 대신 FEN + 수순(SAN 배열)을 저장합니다. 방장 = 백(선수), 참여자 = 흑.

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** 끝난 방은 로비에 안 보이지만 DB에 쌓이므로 하루 지나면 정리합니다(전적·랭킹은 별도 표라 남습니다). */
const FINISHED_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export type RoomStatus = "waiting" | "playing" | "finished";

export type ChessRoom = {
  id: string;
  status: RoomStatus;
  roomName: string;
  whiteId: string;
  whiteName: string;
  blackId: string | null;
  blackName: string | null;
  fen: string;
  moves: string[];
  turn: "w" | "b";
  winner: ChessWinner;
  endReason: ChessEndReason;
  moveCount: number;
  lastFrom: string | null;
  lastTo: string | null;
  timeControl: TimeControl;
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  drawOfferBy: string | null;
  startedAt: string | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
  createdAt: string;
};

type ChessRoomRow = {
  id: string;
  status: RoomStatus;
  room_name: string;
  white_id: string;
  white_name: string;
  black_id: string | null;
  black_name: string | null;
  fen: string;
  moves: string[];
  turn: "w" | "b";
  winner: ChessWinner;
  end_reason: ChessEndReason;
  move_count: number;
  last_from: string | null;
  last_to: string | null;
  time_control: TimeControl | null;
  white_time_ms: number | null;
  black_time_ms: number | null;
  draw_offer_by: string | null;
  started_at: string | null;
  turn_started_at: string | null;
  rematch_by: string | null;
  created_at: string;
};

function mapRow(row: ChessRoomRow): ChessRoom {
  return {
    id: row.id,
    status: row.status,
    roomName: row.room_name,
    whiteId: row.white_id,
    whiteName: row.white_name,
    blackId: row.black_id,
    blackName: row.black_name,
    fen: row.fen,
    moves: Array.isArray(row.moves) ? row.moves : [],
    turn: row.turn,
    winner: row.winner,
    endReason: row.end_reason,
    moveCount: row.move_count,
    lastFrom: row.last_from,
    lastTo: row.last_to,
    timeControl: row.time_control ?? "move60",
    whiteTimeMs: row.white_time_ms,
    blackTimeMs: row.black_time_ms,
    drawOfferBy: row.draw_offer_by,
    startedAt: row.started_at,
    turnStartedAt: row.turn_started_at,
    rematchBy: row.rematch_by,
    createdAt: row.created_at,
  };
}

function clockOf(room: ChessRoom): ClockState {
  return {
    timeControl: room.timeControl,
    turn: room.turn,
    whiteTimeMs: room.whiteTimeMs,
    blackTimeMs: room.blackTimeMs,
    turnStartedAt: room.turnStartedAt,
  };
}

export function colorOf(room: ChessRoom, userId: string): ChessColor | null {
  if (room.whiteId === userId) return "white";
  if (room.blackId === userId) return "black";
  return null;
}

export async function createRoom(
  userId: string,
  userName: string,
  roomName?: string,
  timeControl: TimeControl = "move60",
): Promise<ChessRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const trimmedName = roomName?.trim().slice(0, 40);
  const bank = initialBankMs(timeControl);
  const { data, error } = await supabase
    .from("chess_rooms")
    .insert({
      white_id: userId,
      white_name: userName,
      room_name: trimmedName || `${userName}님의 방`,
      fen: START_FEN,
      moves: [],
      time_control: timeControl,
      white_time_ms: bank,
      black_time_ms: bank,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("chess createRoom error:", error);
    return null;
  }
  return mapRow(data as ChessRoomRow);
}

async function cleanupOldFinishedRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - FINISHED_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("chess_rooms").delete().eq("status", "finished").lt("updated_at", cutoff);
  if (error) console.error("chess cleanupOldFinishedRooms error:", error);
}

export async function listRooms(): Promise<ChessRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // 로비를 열 때마다 가볍게 청소합니다(조건에 맞는 행이 없으면 바로 끝).
  await cleanupOldFinishedRooms();

  const { data, error } = await supabase
    .from("chess_rooms")
    .select()
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as ChessRoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<ChessRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.from("chess_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as ChessRoomRow);
}

export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
): Promise<ChessRoom | null | "full" | "self"> {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.whiteId === userId) return "self";
  if (room.status !== "waiting" || room.blackId) return "full";

  const supabase = getSupabase();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chess_rooms")
    .update({
      black_id: userId,
      black_name: userName,
      status: "playing",
      started_at: now,
      turn_started_at: now,
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select()
    .single();

  if (error || !data) {
    console.error("chess joinRoom error:", error);
    return null;
  }
  return mapRow(data as ChessRoomRow);
}

async function finishRoom(
  room: ChessRoom,
  winner: Exclude<ChessWinner, null>,
  reason: Exclude<ChessEndReason, null>,
): Promise<ChessRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("chess_rooms")
    .update({
      status: "finished",
      winner,
      end_reason: reason,
      turn_started_at: null,
      rematch_by: null,
      draw_offer_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", room.id)
    .eq("status", "playing")
    .select()
    .maybeSingle();

  if (error) {
    console.error("chess finishRoom error:", error);
    return null;
  }
  if (!data) return null; // 이미 다른 경로로 종료된 방

  const finished = mapRow(data as ChessRoomRow);
  await recordChessMatchResult(finished, winner);
  return finished;
}

/** "게임 나가기": 대기 중이면 방 삭제, 대국 중이면 기권(상대 승), 종료 후엔 신청만 정리. */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const room = await getRoom(roomId);
  if (!room) return;

  const myColor = colorOf(room, userId);
  if (!myColor) return;

  if (room.status === "waiting") {
    if (myColor !== "white") return;
    const { error } = await supabase.from("chess_rooms").delete().eq("id", roomId).eq("status", "waiting");
    if (error) console.error("chess leaveRoom(delete) error:", error);
    return;
  }

  if (room.status === "playing") {
    await finishRoom(room, myColor === "white" ? "black" : "white", "resign");
    return;
  }

  if (room.status === "finished" && room.rematchBy) {
    const { error } = await supabase
      .from("chess_rooms")
      .update({ rematch_by: null, updated_at: new Date().toISOString() })
      .eq("id", roomId);
    if (error) console.error("chess leaveRoom(clear rematch) error:", error);
  }
}

/**
 * "기권하기": 대국 중인 사람이 그 판을 내줍니다. leaveRoom과 결과는 같지만
 * 자리를 그대로 둬서, 기권한 사람도 방에 남아 결과와 재대국 신청을 봅니다.
 */
export async function resign(
  roomId: string,
  userId: string,
): Promise<{ room: ChessRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 대국이 아니에요." };

  const myColor = colorOf(room, userId);
  if (!myColor) return { error: "참여자만 기권할 수 있어요." };

  await finishRoom(room, myColor === "white" ? "black" : "white", "resign");

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

export async function claimDisconnectWin(
  roomId: string,
  userId: string,
): Promise<{ room: ChessRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const myColor = colorOf(room, userId);
  if (!myColor) return { error: "참여자만 할 수 있어요." };

  await finishRoom(room, myColor, "disconnect");
  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

// ---------- 무승부 제안 ----------

export async function offerDraw(roomId: string, userId: string): Promise<ChessRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 대국에서만 제안할 수 있어요." };
  if (!colorOf(room, userId)) return { error: "참여자만 제안할 수 있어요." };
  if (room.drawOfferBy === userId) return { error: "이미 무승부를 제안했어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("chess_rooms")
    .update({ draw_offer_by: userId, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "playing")
    .select()
    .maybeSingle();
  if (error) {
    console.error("chess offerDraw error:", error);
    return { error: "무승부를 제안하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as ChessRoomRow);
}

export async function acceptDraw(roomId: string, userId: string): Promise<ChessRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 대국이 아니에요." };
  if (!colorOf(room, userId)) return { error: "참여자만 수락할 수 있어요." };
  if (!room.drawOfferBy) return { error: "무승부 제안이 없어요." };
  if (room.drawOfferBy === userId) return { error: "상대의 수락을 기다리는 중이에요." };

  const finished = await finishRoom(room, "draw", "agreement");
  if (!finished) return { error: "이미 다른 상태로 바뀌었어요." };
  return finished;
}

export async function declineDraw(roomId: string, userId: string): Promise<ChessRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (!colorOf(room, userId)) return { error: "참여자만 할 수 있어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("chess_rooms")
    .update({ draw_offer_by: null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select()
    .maybeSingle();
  if (error) {
    console.error("chess declineDraw error:", error);
    return { error: "처리하지 못했어요." };
  }
  if (!data) return { error: "방을 찾을 수 없어요." };
  return mapRow(data as ChessRoomRow);
}

// ---------- 재대국 ----------

export async function requestRematch(roomId: string, userId: string): Promise<ChessRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (!colorOf(room, userId)) return { error: "참여자만 재대국을 신청할 수 있어요." };
  if (!room.blackId) return { error: "상대가 없어서 다시 시작할 수 없어요." };
  if (room.rematchBy === userId) return { error: "이미 재대국을 신청했어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("chess_rooms")
    .update({ rematch_by: userId, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "finished")
    .select()
    .maybeSingle();

  if (error) {
    console.error("chess requestRematch error:", error);
    return { error: "재대국을 신청하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as ChessRoomRow);
}

/** 재대국 수락: 백/흑을 교대하고 국면·시계를 초기화합니다. */
export async function acceptRematch(roomId: string, userId: string): Promise<ChessRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (!colorOf(room, userId)) return { error: "참여자만 수락할 수 있어요." };
  if (!room.rematchBy) return { error: "재대국 신청이 없어요." };
  if (room.rematchBy === userId) return { error: "상대의 수락을 기다리는 중이에요." };
  if (!room.blackId) return { error: "상대가 없어서 다시 시작할 수 없어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const now = new Date().toISOString();
  const bank = initialBankMs(room.timeControl);
  const { data, error } = await supabase
    .from("chess_rooms")
    .update({
      ...swappedColors(room),
      fen: START_FEN,
      moves: [],
      turn: "w",
      winner: null,
      end_reason: null,
      status: "playing",
      move_count: 0,
      last_from: null,
      last_to: null,
      white_time_ms: bank,
      black_time_ms: bank,
      draw_offer_by: null,
      rematch_by: null,
      started_at: now,
      turn_started_at: now,
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("status", "finished")
    .eq("rematch_by", room.rematchBy)
    .select()
    .maybeSingle();

  if (error) {
    console.error("chess acceptRematch error:", error);
    return { error: "다시 시작하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as ChessRoomRow);
}

export async function declineRematch(roomId: string, userId: string): Promise<ChessRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (!colorOf(room, userId)) return { error: "참여자만 할 수 있어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("chess_rooms")
    .update({ rematch_by: null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("chess declineRematch error:", error);
    return { error: "처리하지 못했어요." };
  }
  if (!data) return { error: "방을 찾을 수 없어요." };
  return mapRow(data as ChessRoomRow);
}

// ---------- 시계 ----------

/** 제한 시간이 지나면 현재 차례인 쪽이 시간패. 판정은 DB 값으로 다시 계산합니다. */
export async function timeoutTurn(roomId: string, userId: string): Promise<{ room: ChessRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  if (!colorOf(room, userId)) return { error: "참여자만 할 수 있어요." };
  if (!isClockExpired(clockOf(room), Date.now())) return { error: "아직 시간이 남아 있어요." };

  const winner: ChessColor = room.turn === "w" ? "black" : "white";
  await finishRoom(room, winner, "timeout");

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

// ---------- 착수 ----------

export async function submitMove(
  roomId: string,
  userId: string,
  from: string,
  to: string,
  promotion?: string,
): Promise<{ room: ChessRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const myColor = colorOf(room, userId);
  if (!myColor) return { error: "참여자만 둘 수 있어요." };

  const nowMs = Date.now();
  // 수를 두기 전에 이미 시간이 다 됐으면 그 수는 인정하지 않고 시간패로 끝냅니다.
  if (room.turn === (myColor === "white" ? "w" : "b") && isClockExpired(clockOf(room), nowMs)) {
    await finishRoom(room, myColor === "white" ? "black" : "white", "timeout");
    return { error: "시간이 다 돼서 패배 처리됐어요." };
  }

  const result = applyChessMove(room.moves, myColor, from, to, promotion);
  if (!result.ok) return { error: result.error };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const banks = banksAfterMove(clockOf(room), nowMs);
  const now = new Date(nowMs).toISOString();

  // 낙관적 동시성 제어: 읽어온 move_count와 DB의 move_count가 다르면 0행 매치로 실패합니다.
  const { data, error } = await supabase
    .from("chess_rooms")
    .update({
      fen: result.fen,
      moves: result.moves,
      turn: result.turn,
      status: result.finished ? "finished" : "playing",
      winner: result.winner,
      end_reason: result.endReason,
      move_count: room.moveCount + 1,
      last_from: result.from,
      last_to: result.to,
      white_time_ms: banks.white_time_ms,
      black_time_ms: banks.black_time_ms,
      turn_started_at: result.finished ? null : now,
      // 수를 두면 걸려 있던 무승부 제안은 자동으로 거절된 것으로 봅니다.
      draw_offer_by: null,
      rematch_by: null,
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("move_count", room.moveCount)
    .select()
    .maybeSingle();

  if (error) {
    console.error("chess submitMove error:", error);
    return { error: "이동을 저장하지 못했어요." };
  }
  if (!data) return { error: "다른 수가 먼저 처리됐어요. 다시 시도해주세요." };

  const updatedRoom = mapRow(data as ChessRoomRow);
  if (result.finished && updatedRoom.winner) {
    await recordChessMatchResult(updatedRoom, updatedRoom.winner);
  }
  return { room: updatedRoom };
}
