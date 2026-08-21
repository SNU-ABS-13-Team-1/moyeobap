import { getSupabase } from "./supabase";
import { recordMatchResult } from "./omokRanking";
import { FORBIDDEN_MOVE_MESSAGES, isForbiddenMove } from "./omokForbidden";
import { isTurnExpired, swappedColors } from "./omokMatch";

export const BOARD_SIZE = 15;
const WIN_LENGTH = 5;

export type Stone = "black" | "white" | null;
export type RoomStatus = "waiting" | "playing" | "finished";
export type Winner = "black" | "white" | "draw" | null;

export type OmokRoom = {
  id: string;
  status: RoomStatus;
  roomName: string;
  blackId: string;
  blackName: string;
  whiteId: string | null;
  whiteName: string | null;
  board: Stone[][];
  turn: "black" | "white";
  winner: Winner;
  moveCount: number;
  lastRow: number | null;
  lastCol: number | null;
  startedAt: string | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
  createdAt: string;
};

type OmokRoomRow = {
  id: string;
  status: RoomStatus;
  room_name: string;
  black_id: string;
  black_name: string;
  white_id: string | null;
  white_name: string | null;
  board: Stone[][];
  turn: "black" | "white";
  winner: Winner;
  move_count: number;
  last_row: number | null;
  last_col: number | null;
  started_at: string | null;
  turn_started_at: string | null;
  rematch_by: string | null;
  created_at: string;
};

function createEmptyBoard(): Stone[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array<Stone>(BOARD_SIZE).fill(null));
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function checkWin(board: Stone[][], row: number, col: number, player: Stone): boolean {
  if (!player) return false;
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count += 1;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

function mapRow(row: OmokRoomRow): OmokRoom {
  return {
    id: row.id,
    status: row.status,
    roomName: row.room_name,
    blackId: row.black_id,
    blackName: row.black_name,
    whiteId: row.white_id,
    whiteName: row.white_name,
    board: row.board,
    turn: row.turn,
    winner: row.winner,
    moveCount: row.move_count,
    lastRow: row.last_row,
    lastCol: row.last_col,
    startedAt: row.started_at,
    turnStartedAt: row.turn_started_at,
    rematchBy: row.rematch_by,
    createdAt: row.created_at,
  };
}

export async function createRoom(
  userId: string,
  userName: string,
  roomName?: string,
): Promise<OmokRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const trimmedName = roomName?.trim().slice(0, 40);

  const { data, error } = await supabase
    .from("omok_rooms")
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
  return mapRow(data as OmokRoomRow);
}

// 로비 목록: 대기 중이거나 이미 진행 중인 방을 모두 보여줘서, 빈 자리가
// 있으면 참여하고 없으면 관전으로 들어갈 수 있게 합니다. 종료된 방은
// 로비를 어지럽히지 않도록 제외합니다.
export async function listRooms(): Promise<OmokRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("omok_rooms")
    .select()
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as OmokRoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<OmokRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.from("omok_rooms").select().eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as OmokRoomRow);
}

export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
): Promise<OmokRoom | null | "full" | "self"> {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.blackId === userId) return "self";
  if (room.status !== "waiting" || room.whiteId) return "full";

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("omok_rooms")
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
  return mapRow(data as OmokRoomRow);
}

async function finishRoomWithWinner(room: OmokRoom, winnerColor: "black" | "white"): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("omok_rooms")
    .update({
      status: "finished",
      winner: winnerColor,
      // 끝난 방은 시계를 멈추고, 이전 대국에서 남아 있던 재대국 신청도
      // 정리합니다.
      turn_started_at: null,
      rematch_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", room.id)
    .eq("status", "playing")
    .select()
    .maybeSingle();

  if (error) {
    console.error("finishRoomWithWinner error:", error);
    return;
  }
  if (!data) return; // 이미 다른 경로(정상 승부 등)로 종료된 방이에요.

  await recordMatchResult(mapRow(data as OmokRoomRow), winnerColor);
}

/**
 * "게임 나가기" 버튼의 서버 처리입니다. 방 상태에 따라 동작이 달라집니다.
 * - waiting: 방장(흑)이 나가면 방을 삭제합니다. 아직 시작 전이라 잃을 게
 *   없습니다.
 * - playing: 나가는 사람이 기권한 것으로 보고 상대가 승리합니다. 전적도
 *   함께 기록합니다.
 * - finished: 승부는 그대로 두고, 남아 있던 재대국 신청만 정리합니다.
 *   재대국은 상대가 수락해야 시작되므로(requestRematch/acceptRematch),
 *   여기서 방이 playing으로 되돌아가 있는 일은 없습니다.
 */
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
    const { error } = await supabase
      .from("omok_rooms")
      .delete()
      .eq("id", roomId)
      .eq("status", "waiting");
    if (error) console.error("leaveRoom(delete) error:", error);
    return;
  }

  if (room.status === "playing") {
    const winnerColor: "black" | "white" = isBlack ? "white" : "black";
    await finishRoomWithWinner(room, winnerColor);
    return;
  }

  // 나간 사람이 걸어둔 재대국 신청이 남아 있으면, 남은 사람이 이미 자리를
  // 뜬 상대에게 "수락" 버튼을 보게 되므로 지웁니다.
  if (room.status === "finished" && room.rematchBy) {
    const { error } = await supabase
      .from("omok_rooms")
      .update({ rematch_by: null, updated_at: new Date().toISOString() })
      .eq("id", roomId);
    if (error) console.error("leaveRoom(clear rematch) error:", error);
  }
}

/**
 * 상대가 대국 중 연결이 끊긴 뒤 일정 시간 돌아오지 않을 때, 남은 플레이어가
 * 직접 승리 처리할 수 있게 합니다. 서버는 Presence(실시간 접속 여부)를 직접
 * 확인할 방법이 없으므로 "상대가 일정 시간 자리를 비웠다"는 판단은
 * 클라이언트(60초 타이머)를 신뢰합니다. 내부 소규모 팀 앱이라 악용 위험이
 * 낮고, 악용되더라도 상대가 즉시 화면에서 확인하고 다시 대국을 시작하면
 * 됩니다.
 */
export async function claimDisconnectWin(
  roomId: string,
  userId: string,
): Promise<{ room: OmokRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 할 수 있어요." };

  const myColor: "black" | "white" = isBlack ? "black" : "white";
  await finishRoomWithWinner(room, myColor);

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
}

/**
 * 재대국은 "신청 -> 상대 수락" 두 단계입니다. 한 사람이 혼자 방을 다시
 * playing으로 되돌리면, 아직 종료 화면을 보고 있던 상대가 "게임 나가기"를
 * 눌렀을 때 기권으로 처리돼 패가 쌓입니다. 수락 전까지 방을 finished로
 * 두면 그 경로 자체가 없어집니다.
 */
export async function requestRematch(
  roomId: string,
  userId: string,
): Promise<OmokRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 재대국을 신청할 수 있어요." };
  }
  if (!room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };
  if (room.rematchBy === userId) return { error: "이미 재대국을 신청했어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("omok_rooms")
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
  return mapRow(data as OmokRoomRow);
}

/**
 * 상대의 재대국 신청을 수락해 새 판을 시작합니다. 흑/백은 통째로 교대되고
 * (같은 방에서 계속 두면 선을 잡는 쪽이 고정되므로) 보드·턴·시계가
 * 초기화됩니다.
 */
export async function acceptRematch(
  roomId: string,
  userId: string,
): Promise<OmokRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 수락할 수 있어요." };
  }
  if (!room.rematchBy) return { error: "재대국 신청이 없어요." };
  if (room.rematchBy === userId) return { error: "상대의 수락을 기다리는 중이에요." };
  if (!room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("omok_rooms")
    .update({
      ...swappedColors(room),
      board: createEmptyBoard(),
      turn: "black",
      winner: null,
      status: "playing",
      move_count: 0,
      last_row: null,
      last_col: null,
      rematch_by: null,
      started_at: now,
      turn_started_at: now,
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("status", "finished")
    // 신청이 그대로 남아 있을 때만 성립합니다. 그 사이 상대가 신청을
    // 취소했다면 0행에 매치돼 조용히 실패합니다.
    .eq("rematch_by", room.rematchBy)
    .select()
    .maybeSingle();

  if (error) {
    console.error("acceptRematch error:", error);
    return { error: "다시 시작하지 못했어요." };
  }
  if (!data) return { error: "이미 다른 상태로 바뀌었어요." };
  return mapRow(data as OmokRoomRow);
}

/** 재대국 신청을 거절하거나(받은 쪽), 취소합니다(보낸 쪽). */
export async function declineRematch(
  roomId: string,
  userId: string,
): Promise<OmokRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 할 수 있어요." };
  }

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("omok_rooms")
    .update({ rematch_by: null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("declineRematch error:", error);
    return { error: "처리하지 못했어요." };
  }
  if (!data) return { error: "방을 찾을 수 없어요." };
  return mapRow(data as OmokRoomRow);
}

/**
 * 한 수의 제한 시간이 지났을 때 현재 차례인 쪽을 패배 처리합니다.
 *
 * 양쪽 클라이언트가 각자 카운트다운을 돌리다 0이 되면 호출하므로 중복 호출이
 * 정상입니다. 실제 판정은 여기서 DB의 turn_started_at으로 다시 계산하고,
 * 확정은 finishRoomWithWinner의 status='playing' 조건이 한 번만 통과시킵니다.
 */
export async function timeoutTurn(
  roomId: string,
  userId: string,
): Promise<{ room: OmokRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 할 수 있어요." };
  }
  if (!isTurnExpired(room.turnStartedAt, Date.now())) {
    return { error: "아직 시간이 남아 있어요." };
  }

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
): Promise<{ room: OmokRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 둘 수 있어요." };

  const myColor: "black" | "white" = isBlack ? "black" : "white";
  if (room.turn !== myColor) return { error: "상대 차례예요." };

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { error: "잘못된 위치예요." };
  }
  if (room.board[row][col] !== null) return { error: "이미 돌이 놓인 자리예요." };

  const nextBoard = room.board.map((r) => [...r]);
  nextBoard[row][col] = myColor;

  // 흑 전용 금수(6목 이상, 쌍삼) 판정입니다. 백은 항상 통과합니다. 금수면
  // 여기서 바로 에러를 반환해 DB에 아무것도 쓰지 않으므로, 착수가 실제로
  // 확정되지 않습니다(app/lib/omokForbidden.ts 참고). 정확히 5목이 되는
  // 수는 쌍삼보다 우선해 통과하므로, 아래 checkWin이 그대로 승리를 잡습니다.
  const forbidden = isForbiddenMove(nextBoard, row, col, myColor);
  if (forbidden.forbidden && forbidden.reason) {
    return { error: FORBIDDEN_MOVE_MESSAGES[forbidden.reason] };
  }

  const won = checkWin(nextBoard, row, col, myColor);
  const isDraw = !won && nextBoard.every((r) => r.every((cell) => cell !== null));
  const finished = won || isDraw;

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  // 낙관적 동시성 제어: 읽어온 move_count와 지금 DB의 move_count가 다르면
  // (다른 수가 그 사이에 먼저 처리됨) 이 UPDATE는 0행에 매치돼 실패합니다.
  // 같은 칸에 두 사람이 동시에 두더라도 보드가 섞이지 않고, 뒤처진 쪽은
  // 안전하게 재시도 에러를 받습니다.
  const { data, error } = await supabase
    .from("omok_rooms")
    .update({
      board: nextBoard,
      turn: myColor === "black" ? "white" : "black",
      status: finished ? "finished" : "playing",
      winner: won ? myColor : isDraw ? "draw" : null,
      move_count: room.moveCount + 1,
      last_row: row,
      last_col: col,
      // 다음 사람의 제한 시간은 이 수가 확정된 순간부터 흐릅니다. 대국이
      // 끝났으면 시계를 멈춰 둡니다(종료된 방은 시간 초과로 처리되지 않음).
      turn_started_at: finished ? null : new Date().toISOString(),
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
  if (!data) {
    return { error: "다른 수가 먼저 처리됐어요. 다시 시도해주세요." };
  }

  const updatedRoom = mapRow(data as OmokRoomRow);
  if (finished && updatedRoom.winner) {
    await recordMatchResult(updatedRoom, updatedRoom.winner);
  }
  return { room: updatedRoom };
}
