import { getSupabase } from "./supabase";
import { recordMatchResult } from "./omokRanking";
import { FORBIDDEN_MOVE_MESSAGES, isForbiddenMove } from "./omokForbidden";

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
 * - finished: 이미 끝난 대국이라 아무 것도 바꾸지 않습니다.
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
 * 종료된 대국을 같은 두 사람이 이어서 새로 시작합니다. 흑/백 배정은 그대로
 * 유지하고 보드와 턴, 마지막 착수 위치만 초기화합니다.
 */
export async function restartRoom(
  roomId: string,
  userId: string,
): Promise<OmokRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 다시 시작할 수 있어요." };
  }
  if (!room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("omok_rooms")
    .update({
      board: createEmptyBoard(),
      turn: "black",
      winner: null,
      status: "playing",
      move_count: 0,
      last_row: null,
      last_col: null,
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
  return mapRow(data as OmokRoomRow);
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
  // 확정되지 않습니다(app/lib/omokForbidden.ts 참고).
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
