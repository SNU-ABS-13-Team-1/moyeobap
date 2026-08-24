import { getSupabase } from "./supabase";
import { recordMatchResult } from "./badukRanking";
import { isTurnExpired, swappedColors } from "./badukMatch";
import { applyMove, createEmptyBoard as createEmptyRulesBoard } from "./badukRules";
import { computeScore, toggleDeadGroup } from "./badukScoring";
import { BOARD_SIZE, KOMI } from "./badukConstants";
import type { Board, Stone } from "./badukRules";

export type RoomStatus = "waiting" | "playing" | "scoring" | "finished";
export type Winner = "black" | "white" | null;

export type BadukRoom = {
  id: string;
  status: RoomStatus;
  roomName: string;
  blackId: string;
  blackName: string;
  whiteId: string | null;
  whiteName: string | null;
  board: Board;
  previousBoard: Board | null;
  turn: "black" | "white";
  moveCount: number;
  passCount: number;
  capturesBlack: number;
  capturesWhite: number;
  deadStones: string[];
  blackConfirmedScore: boolean;
  whiteConfirmedScore: boolean;
  winner: Winner;
  finalBlackScore: number | null;
  finalWhiteScore: number | null;
  lastRow: number | null;
  lastCol: number | null;
  startedAt: string | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
  createdAt: string;
};

type BadukRoomRow = {
  id: string;
  status: RoomStatus;
  room_name: string;
  black_id: string;
  black_name: string;
  white_id: string | null;
  white_name: string | null;
  board: Board;
  previous_board: Board | null;
  turn: "black" | "white";
  move_count: number;
  pass_count: number;
  captures_black: number;
  captures_white: number;
  dead_stones: string[];
  black_confirmed_score: boolean;
  white_confirmed_score: boolean;
  winner: Winner;
  final_black_score: number | null;
  final_white_score: number | null;
  last_row: number | null;
  last_col: number | null;
  started_at: string | null;
  turn_started_at: string | null;
  rematch_by: string | null;
  created_at: string;
};

function createEmptyBoard(): Stone[][] {
  return createEmptyRulesBoard(BOARD_SIZE);
}

function mapRow(row: BadukRoomRow): BadukRoom {
  return {
    id: row.id,
    status: row.status,
    roomName: row.room_name,
    blackId: row.black_id,
    blackName: row.black_name,
    whiteId: row.white_id,
    whiteName: row.white_name,
    board: row.board,
    previousBoard: row.previous_board,
    turn: row.turn,
    moveCount: row.move_count,
    passCount: row.pass_count,
    capturesBlack: row.captures_black,
    capturesWhite: row.captures_white,
    deadStones: row.dead_stones,
    blackConfirmedScore: row.black_confirmed_score,
    whiteConfirmedScore: row.white_confirmed_score,
    winner: row.winner,
    finalBlackScore: row.final_black_score,
    finalWhiteScore: row.final_white_score,
    lastRow: row.last_row,
    lastCol: row.last_col,
    startedAt: row.started_at,
    turnStartedAt: row.turn_started_at,
    rematchBy: row.rematch_by,
    createdAt: row.created_at,
  };
}

export async function createRoom(userId: string, userName: string, roomName?: string): Promise<BadukRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const trimmedName = roomName?.trim().slice(0, 40);

  const { data, error } = await supabase
    .from("baduk_rooms")
    .insert({
      black_id: userId,
      black_name: userName,
      room_name: trimmedName || `${userName}님의 방`,
      board: createEmptyBoard(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createRoom error:", error);
    return null;
  }
  return mapRow(data as BadukRoomRow);
}

export async function listRooms(): Promise<BadukRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("baduk_rooms")
    .select()
    .in("status", ["waiting", "playing", "scoring"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as BadukRoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<BadukRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.from("baduk_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as BadukRoomRow);
}

export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
): Promise<BadukRoom | null | "full" | "self"> {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.blackId === userId) return "self";
  if (room.status !== "waiting" || room.whiteId) return "full";

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      white_id: userId,
      white_name: userName,
      status: "playing",
      started_at: new Date().toISOString(),
      turn_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "waiting")
    .select()
    .single();

  if (error || !data) {
    console.error("joinRoom error:", error);
    return null;
  }
  return mapRow(data as BadukRoomRow);
}

/** move_count를 버전 토큰으로 삼는 이유는 app/lib/omok.ts의 같은 함수와 같습니다
 * — status만으로는, 이 값을 읽은 뒤 상대의 착수·패스로 상태가 먼저 바뀌는
 * 경쟁 상태를 막을 수 없습니다. */
async function finishRoomWithWinner(
  room: BadukRoom,
  winnerColor: "black" | "white",
  scores?: { black: number; white: number },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      status: "finished",
      winner: winnerColor,
      final_black_score: scores?.black ?? null,
      final_white_score: scores?.white ?? null,
      turn_started_at: null,
      rematch_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", room.id)
    .in("status", ["playing", "scoring"])
    .eq("move_count", room.moveCount)
    .select()
    .maybeSingle();

  if (error) {
    console.error("finishRoomWithWinner error:", error);
    return;
  }
  if (!data) return;

  await recordMatchResult(mapRow(data as BadukRoomRow), winnerColor);
}

/** "게임 나가기"의 서버 처리입니다. app/lib/omok.ts의 leaveRoom과 같은 구조.
 * waiting이면 방장이 방을 지우고, playing·scoring이면 기권으로 상대가
 * 이기며, finished면 남은 재대국 신청만 정리합니다. */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const room = await getRoom(roomId);
  if (!room) return;

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return;

  if (room.status === "waiting") {
    if (!isBlack) return;
    const { error } = await supabase.from("baduk_rooms").delete().eq("id", roomId).eq("status", "waiting");
    if (error) console.error("leaveRoom(delete) error:", error);
    return;
  }

  if (room.status === "playing" || room.status === "scoring") {
    const winnerColor: "black" | "white" = isBlack ? "white" : "black";
    await finishRoomWithWinner(room, winnerColor);
    return;
  }

  if (room.status === "finished" && room.rematchBy) {
    const { error } = await supabase
      .from("baduk_rooms")
      .update({ rematch_by: null, updated_at: new Date().toISOString() })
      .eq("id", roomId);
    if (error) console.error("leaveRoom(clear rematch) error:", error);
  }
}

export async function resignRoom(roomId: string, userId: string): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing" && room.status !== "scoring") return { error: "진행 중인 대국이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 기권할 수 있어요." };

  const winnerColor: "black" | "white" = isBlack ? "white" : "black";
  await finishRoomWithWinner(room, winnerColor);

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

/** app/lib/omok.ts의 claimDisconnectWin과 같은 신뢰 모델입니다 — 서버가
 * Presence를 직접 확인할 방법이 없어 클라이언트의 60초 타이머를 신뢰합니다. */
export async function claimDisconnectWin(roomId: string, userId: string): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing" && room.status !== "scoring") return { error: "진행 중인 게임이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 할 수 있어요." };

  const myColor: "black" | "white" = isBlack ? "black" : "white";
  await finishRoomWithWinner(room, myColor);

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

export async function requestRematch(roomId: string, userId: string): Promise<BadukRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) return { error: "참여자만 재대국을 신청할 수 있어요." };
  if (!room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };
  if (room.rematchBy === userId) return { error: "이미 재대국을 신청했어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({ rematch_by: userId, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "finished")
    .select()
    .maybeSingle();

  if (error) {
    console.error("requestRematch error:", error);
    return { error: "재대국을 신청하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as BadukRoomRow);
}

export async function acceptRematch(roomId: string, userId: string): Promise<BadukRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) return { error: "참여자만 수락할 수 있어요." };
  if (!room.rematchBy) return { error: "재대국 신청이 없어요." };
  if (room.rematchBy === userId) return { error: "상대의 수락을 기다리는 중이에요." };
  if (!room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      ...swappedColors(room),
      board: createEmptyBoard(),
      previous_board: null,
      turn: "black",
      winner: null,
      final_black_score: null,
      final_white_score: null,
      status: "playing",
      move_count: 0,
      pass_count: 0,
      captures_black: 0,
      captures_white: 0,
      dead_stones: [],
      black_confirmed_score: false,
      white_confirmed_score: false,
      last_row: null,
      last_col: null,
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
    console.error("acceptRematch error:", error);
    return { error: "다시 시작하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as BadukRoomRow);
}

export async function declineRematch(roomId: string, userId: string): Promise<BadukRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.blackId !== userId && room.whiteId !== userId) return { error: "참여자만 할 수 있어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({ rematch_by: null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("declineRematch error:", error);
    return { error: "처리하지 못했어요." };
  }
  if (!data) return { error: "방을 찾을 수 없어요." };
  return mapRow(data as BadukRoomRow);
}

export async function timeoutTurn(roomId: string, userId: string): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  if (room.blackId !== userId && room.whiteId !== userId) return { error: "참여자만 할 수 있어요." };
  if (!isTurnExpired(room.turnStartedAt, Date.now())) return { error: "아직 시간이 남아 있어요." };

  const winnerColor: "black" | "white" = room.turn === "black" ? "white" : "black";
  await finishRoomWithWinner(room, winnerColor);

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

export async function submitMove(
  roomId: string,
  userId: string,
  row: number,
  col: number,
): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 둘 수 있어요." };

  const myColor: "black" | "white" = isBlack ? "black" : "white";
  if (room.turn !== myColor) return { error: "상대 차례예요." };

  const result = applyMove(room.board, row, col, myColor, room.previousBoard);
  if (!result.ok) return { error: result.error };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const capturesBlack = room.capturesBlack + (myColor === "black" ? result.captured.length : 0);
  const capturesWhite = room.capturesWhite + (myColor === "white" ? result.captured.length : 0);

  // 낙관적 동시성 제어는 app/lib/omok.ts의 submitMove와 동일한 원리입니다.
  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      board: result.board,
      previous_board: room.board,
      turn: myColor === "black" ? "white" : "black",
      move_count: room.moveCount + 1,
      pass_count: 0,
      captures_black: capturesBlack,
      captures_white: capturesWhite,
      last_row: row,
      last_col: col,
      turn_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("move_count", room.moveCount)
    .select()
    .maybeSingle();

  if (error) {
    console.error("submitMove error:", error);
    return { error: "이동을 저장하지 못했어요." };
  }
  if (!data) return { error: "다른 수가 먼저 처리됐어요. 다시 시도해주세요." };

  return { room: mapRow(data as BadukRoomRow) };
}

/** 패스 두 번이 연속되면 계가 단계로 넘어갑니다. */
export async function submitPass(roomId: string, userId: string): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 둘 수 있어요." };

  const myColor: "black" | "white" = isBlack ? "black" : "white";
  if (room.turn !== myColor) return { error: "상대 차례예요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const nextPassCount = room.passCount + 1;
  const enterScoring = nextPassCount >= 2;

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      status: enterScoring ? "scoring" : "playing",
      turn: myColor === "black" ? "white" : "black",
      pass_count: nextPassCount,
      dead_stones: enterScoring ? [] : room.deadStones,
      black_confirmed_score: false,
      white_confirmed_score: false,
      turn_started_at: enterScoring ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("move_count", room.moveCount)
    .select()
    .maybeSingle();

  if (error) {
    console.error("submitPass error:", error);
    return { error: "패스를 처리하지 못했어요." };
  }
  if (!data) return { error: "다른 수가 먼저 처리됐어요. 다시 시도해주세요." };

  return { room: mapRow(data as BadukRoomRow) };
}

/** 계가 중 돌 그룹의 죽음/삶 표시를 토글합니다. 아무 참가자나 누를 수 있고
 * (합의는 confirmScore에서 이뤄짐), 표시가 바뀌면 기존 동의는 무효가 됩니다. */
export async function markDeadGroup(
  roomId: string,
  userId: string,
  row: number,
  col: number,
): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "scoring") return { error: "계가 중이 아니에요." };
  if (room.blackId !== userId && room.whiteId !== userId) return { error: "참여자만 표시할 수 있어요." };

  const nextDeadStones = [...toggleDeadGroup(room.board, new Set(room.deadStones), row, col)];

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      dead_stones: nextDeadStones,
      black_confirmed_score: false,
      white_confirmed_score: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "scoring")
    .select()
    .maybeSingle();

  if (error) {
    console.error("markDeadGroup error:", error);
    return { error: "표시하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };

  return { room: mapRow(data as BadukRoomRow) };
}

/** 내 쪽의 계가 동의를 표시합니다. 양쪽이 모두 동의하면 서버가 집 계산을
 * 확정하고 대국을 종료합니다. */
export async function confirmScore(roomId: string, userId: string): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "scoring") return { error: "계가 중이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 동의할 수 있어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const blackConfirmed = isBlack ? true : room.blackConfirmedScore;
  const whiteConfirmed = isWhite ? true : room.whiteConfirmedScore;
  const bothConfirmed = blackConfirmed && whiteConfirmed;

  if (!bothConfirmed) {
    const { data, error } = await supabase
      .from("baduk_rooms")
      .update({
        black_confirmed_score: blackConfirmed,
        white_confirmed_score: whiteConfirmed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .eq("status", "scoring")
      .select()
      .maybeSingle();

    if (error) {
      console.error("confirmScore error:", error);
      return { error: "동의를 저장하지 못했어요." };
    }
    if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
    return { room: mapRow(data as BadukRoomRow) };
  }

  const score = computeScore(room.board, new Set(room.deadStones), KOMI);

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      status: "finished",
      winner: score.winner,
      final_black_score: score.blackScore,
      final_white_score: score.whiteScore,
      black_confirmed_score: true,
      white_confirmed_score: true,
      turn_started_at: null,
      rematch_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "scoring")
    .select()
    .maybeSingle();

  if (error) {
    console.error("confirmScore(finish) error:", error);
    return { error: "계가를 확정하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };

  const finishedRoom = mapRow(data as BadukRoomRow);
  await recordMatchResult(finishedRoom, score.winner);
  return { room: finishedRoom };
}

/** 계가 합의가 안 될 때, 죽은 돌 표시를 지우고 다시 두는 단계로 돌아갑니다. */
export async function resumePlay(roomId: string, userId: string): Promise<{ room: BadukRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "scoring") return { error: "계가 중이 아니에요." };
  if (room.blackId !== userId && room.whiteId !== userId) return { error: "참여자만 할 수 있어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("baduk_rooms")
    .update({
      status: "playing",
      pass_count: 0,
      dead_stones: [],
      black_confirmed_score: false,
      white_confirmed_score: false,
      turn_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("status", "scoring")
    .select()
    .maybeSingle();

  if (error) {
    console.error("resumePlay error:", error);
    return { error: "다시 두기로 돌아가지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };

  return { room: mapRow(data as BadukRoomRow) };
}
