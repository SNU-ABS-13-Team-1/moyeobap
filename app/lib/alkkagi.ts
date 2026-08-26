import { getSupabase } from "./supabase";
import { recordMatchResult } from "./alkkagiRanking";
import { isTurnExpired, swappedColors } from "./alkkagiMatch";
import { resolveLeave, resolveSit } from "./gameSeats";
import {
  MIN_SHOT_SPEED,
  clampShot,
  initialStones,
  simulateShot,
  type Shot,
  type Stone,
} from "./alkkagiPhysics";

/** 하루 동안 아무 움직임이 없는 방은 상태와 무관하게 정리합니다(전적·랭킹은
 * 별도 표라 남습니다). 진행 중인 방도 포함합니다 — 정상 진행 중엔 매 샷마다
 * updated_at이 갱신되므로, 24시간 멈춘 방은 전원이 창을 닫고 떠난 방입니다. */
const STALE_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export type RoomStatus = "waiting" | "playing" | "finished";
export type Winner = "black" | "white" | "draw" | null;

export type AlkkagiRoom = {
  id: string;
  status: RoomStatus;
  roomName: string;
  blackId: string | null;
  blackName: string | null;
  whiteId: string | null;
  whiteName: string | null;
  stones: Stone[];
  /** 직전 샷을 쏘기 전의 배치. last_shot과 짝을 이뤄 재생 필름이 됩니다. */
  preShotStones: Stone[] | null;
  lastShot: Shot | null;
  lastShotAt: string | null;
  shotSeq: number;
  turn: "black" | "white";
  winner: Winner;
  shotCount: number;
  startedAt: string | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
  createdAt: string;
};

type AlkkagiRoomRow = {
  id: string;
  status: RoomStatus;
  room_name: string;
  black_id: string | null;
  black_name: string | null;
  white_id: string | null;
  white_name: string | null;
  stones: Stone[];
  pre_shot_stones: Stone[] | null;
  last_shot: Shot | null;
  last_shot_at: string | null;
  shot_seq: number;
  turn: "black" | "white";
  winner: Winner;
  shot_count: number;
  started_at: string | null;
  turn_started_at: string | null;
  rematch_by: string | null;
  created_at: string;
};

function mapRow(row: AlkkagiRoomRow): AlkkagiRoom {
  return {
    id: row.id,
    status: row.status,
    roomName: row.room_name,
    blackId: row.black_id,
    blackName: row.black_name,
    whiteId: row.white_id,
    whiteName: row.white_name,
    stones: Array.isArray(row.stones) ? row.stones : [],
    preShotStones: Array.isArray(row.pre_shot_stones) ? row.pre_shot_stones : null,
    lastShot: row.last_shot,
    lastShotAt: row.last_shot_at,
    shotSeq: row.shot_seq,
    turn: row.turn,
    winner: row.winner,
    shotCount: row.shot_count,
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
): Promise<AlkkagiRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const trimmedName = roomName?.trim().slice(0, 40);

  const { data, error } = await supabase
    .from("alkkagi_rooms")
    .insert({
      black_id: userId,
      black_name: userName,
      room_name: trimmedName || `${userName}님의 방`,
      stones: initialStones(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createRoom error:", error);
    return null;
  }
  return mapRow(data as AlkkagiRoomRow);
}

async function cleanupStaleRooms(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const cutoff = new Date(Date.now() - STALE_ROOM_TTL_MS).toISOString();
  const { error } = await supabase.from("alkkagi_rooms").delete().lt("updated_at", cutoff);
  if (error) console.error("alkkagi cleanupStaleRooms error:", error);
}

// 로비 목록: 대기 중이거나 이미 진행 중인 방을 모두 보여줘서, 빈 자리가
// 있으면 참여하고 없으면 관전으로 들어갈 수 있게 합니다. 종료된 방은
// 로비를 어지럽히지 않도록 제외합니다.
export async function listRooms(): Promise<AlkkagiRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // 로비를 열 때마다 가볍게 청소합니다(조건에 맞는 행이 없으면 바로 끝).
  await cleanupStaleRooms();

  const { data, error } = await supabase
    .from("alkkagi_rooms")
    .select()
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as AlkkagiRoomRow[]).map(mapRow);
}

export async function getRoom(roomId: string): Promise<AlkkagiRoom | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("alkkagi_rooms")
    .select()
    .eq("id", roomId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as AlkkagiRoomRow);
}

/**
 * 빈 자리에 앉습니다. 두 갈래를 하나로 처리합니다.
 * - 대기 중인 방에 들어가면 백을 잡고 바로 대국이 시작됩니다.
 * - 상대가 나가 자리가 빈 종료된 방이면, 관전자가 그 자리에 앉습니다.
 *   승부 기록은 그대로 두고 status도 finished로 남겨, 두 사람이 재대국을
 *   신청·수락해 새 판을 시작합니다.
 */
export async function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
): Promise<AlkkagiRoom | null | "full" | "self"> {
  const room = await getRoom(roomId);
  if (!room) return null;

  const outcome = resolveSit(
    { status: room.status, hostId: room.blackId, guestId: room.whiteId },
    userId,
  );
  if (outcome.kind === "self") return "self";
  if (outcome.kind === "full") return "full";

  const supabase = getSupabase();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const seatColumn = outcome.seat === "host" ? "black_id" : "white_id";
  const seatUpdate =
    outcome.seat === "host"
      ? { black_id: userId, black_name: userName }
      : { white_id: userId, white_name: userName };
  // 새 판은 언제나 돌 5개씩부터 시작합니다.
  const startUpdate = outcome.start
    ? {
        status: "playing" as const,
        stones: initialStones(),
        pre_shot_stones: null,
        last_shot: null,
        last_shot_at: null,
        turn: "black" as const,
        started_at: now,
        turn_started_at: now,
      }
    : {};

  // 그 사이 다른 사람이 먼저 앉았다면(자리가 null이 아니게 됨) 0행에 매치돼
  // 조용히 실패합니다.
  const { data, error } = await supabase
    .from("alkkagi_rooms")
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
  return mapRow(data as AlkkagiRoomRow);
}

/**
 * shot_seq까지 조건에 거는 이유: room.status를 읽은 시점과 이 UPDATE를
 * 실행하는 시점 사이에 상대의 샷(승리 판정 포함)이 먼저 끝나버리는 경쟁
 * 상태에서, status만 확인하면 그 사이 이미 승부가 났는데도 낡은 "playing"
 * 값을 근거로 종료 처리를 덮어써 recordMatchResult가 두 번 불릴 수 있습니다
 * (예: 방금 이긴 사람이 "나가기"를 눌렀는데 패배가 추가로 기록되는 버그).
 * shot_seq는 샷마다 반드시 바뀌므로, 그 사이 어떤 샷이라도 먼저 처리됐다면
 * 이 UPDATE는 0행에 매치되어 안전하게 무시됩니다.
 */
async function finishRoomWithWinner(
  room: AlkkagiRoom,
  winnerColor: "black" | "white" | "draw",
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("alkkagi_rooms")
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
    .eq("shot_seq", room.shotSeq)
    .select()
    .maybeSingle();

  if (error) {
    console.error("finishRoomWithWinner error:", error);
    return;
  }
  if (!data) return; // 이미 다른 경로(정상 승부 등)로 종료된 방이에요.

  await recordMatchResult(mapRow(data as AlkkagiRoomRow), winnerColor);
}

/**
 * "게임 나가기" 버튼의 서버 처리입니다. 방은 사람이 한 명이라도 남아 있는
 * 한 사라지지 않고, 나간 사람의 자리만 비웁니다(규칙은 app/lib/gameSeats.ts).
 * - playing: 나가는 사람이 기권한 것으로 보고 상대가 승리합니다.
 * - waiting/finished: 자리만 비웁니다. 남은 사람이 없으면 그때 방을 지웁니다.
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const room = await getRoom(roomId);
  if (!room) return;

  const outcome = resolveLeave(
    { status: room.status, hostId: room.blackId, guestId: room.whiteId },
    userId,
  );
  if (outcome.kind === "ignore") return;

  if (outcome.kind === "delete") {
    // 상대 자리가 그 사이 채워졌다면(관전자가 앉음) 지우면 안 되므로 조건에
    // 함께 겁니다.
    const otherColumn = room.blackId === userId ? "white_id" : "black_id";
    const { error } = await supabase
      .from("alkkagi_rooms")
      .delete()
      .eq("id", roomId)
      .eq("status", room.status)
      .is(otherColumn, null);
    if (error) console.error("leaveRoom(delete) error:", error);
    return;
  }

  // 기권은 자리를 비우기 전에 처리해야 전적에 두 사람 이름이 그대로 남습니다.
  // finishRoomWithWinner는 shot_seq가 그 사이 바뀌면 아무것도 하지 않으므로
  // (상대의 샷이 먼저 처리된 경우) 최신 상태로 한 번 더 시도합니다. 그래도
  // playing이면 자리를 비우지 않습니다 — 진행 중인데 한 자리가 빈 방이 남으면
  // 남은 사람이 아무것도 할 수 없게 됩니다(그 경우는 상대가 몰수승 처리하거나
  // 24시간 뒤 방 청소로 정리됩니다).
  if (outcome.kind === "resign") {
    const winnerColor: "black" | "white" = outcome.seat === "host" ? "white" : "black";
    let current: AlkkagiRoom | null = room;
    for (let attempt = 0; attempt < 2 && current?.status === "playing"; attempt += 1) {
      await finishRoomWithWinner(current, winnerColor);
      current = await getRoom(roomId);
    }
    if (current?.status === "playing") return;
  }

  await vacateSeat(roomId, userId, outcome.seat);
}

/**
 * 나간 사람의 자리를 비웁니다. 남아 있던 재대국 신청도 함께 지웁니다 —
 * 신청을 건 사람이 떠났거나, 남은 사람이 이미 자리를 뜬 상대에게 "수락"
 * 버튼을 보게 되기 때문입니다.
 */
async function vacateSeat(roomId: string, userId: string, seat: "host" | "guest"): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const seatUpdate =
    seat === "host" ? { black_id: null, black_name: null } : { white_id: null, white_name: null };
  const seatColumn = seat === "host" ? "black_id" : "white_id";

  const { error } = await supabase
    .from("alkkagi_rooms")
    .update({ ...seatUpdate, rematch_by: null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq(seatColumn, userId);
  if (error) console.error("leaveRoom(vacate) error:", error);
}

/**
 * "기권하기" 버튼의 서버 처리입니다. leaveRoom과 결과(상대 승리 + 전적 기록)는
 * 같지만, 방에서 자리를 빼지 않습니다. 기권한 사람도 그대로 방에 남아 결과와
 * 재대국 신청을 볼 수 있게 하려는 것입니다.
 */
export async function resign(
  roomId: string,
  userId: string,
): Promise<{ room: AlkkagiRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 대국이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 기권할 수 있어요." };

  await finishRoomWithWinner(room, isBlack ? "white" : "black");

  const updated = await getRoom(roomId);
  if (!updated) return { error: "방을 찾을 수 없어요." };
  return { room: updated };
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
): Promise<{ room: AlkkagiRoom } | { error: string }> {
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
): Promise<AlkkagiRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 재대국을 신청할 수 있어요." };
  }
  if (!room.blackId || !room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };
  if (room.rematchBy === userId) return { error: "이미 재대국을 신청했어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("alkkagi_rooms")
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
  return mapRow(data as AlkkagiRoomRow);
}

/**
 * 상대의 재대국 신청을 수락해 새 판을 시작합니다. 흑/백은 통째로 교대되고
 * (같은 방에서 계속 두면 선을 잡는 쪽이 고정되므로) 판·턴·시계가
 * 초기화됩니다.
 */
export async function acceptRematch(
  roomId: string,
  userId: string,
): Promise<AlkkagiRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "finished") return { error: "종료된 대국만 다시 시작할 수 있어요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 수락할 수 있어요." };
  }
  if (!room.rematchBy) return { error: "재대국 신청이 없어요." };
  if (room.rematchBy === userId) return { error: "상대의 수락을 기다리는 중이에요." };
  if (!room.blackId || !room.whiteId) return { error: "상대가 없어서 다시 시작할 수 없어요." };

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("alkkagi_rooms")
    .update({
      ...swappedColors(room),
      stones: initialStones(),
      pre_shot_stones: null,
      last_shot: null,
      last_shot_at: null,
      shot_seq: 0,
      shot_count: 0,
      turn: "black",
      winner: null,
      status: "playing",
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
  return mapRow(data as AlkkagiRoomRow);
}

/** 재대국 신청을 거절하거나(받은 쪽), 취소합니다(보낸 쪽). */
export async function declineRematch(
  roomId: string,
  userId: string,
): Promise<AlkkagiRoom | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.blackId !== userId && room.whiteId !== userId) {
    return { error: "참여자만 할 수 있어요." };
  }

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const { data, error } = await supabase
    .from("alkkagi_rooms")
    .update({ rematch_by: null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("declineRematch error:", error);
    return { error: "처리하지 못했어요." };
  }
  if (!data) return { error: "방을 찾을 수 없어요." };
  return mapRow(data as AlkkagiRoomRow);
}

/**
 * 한 턴의 제한 시간이 지났을 때 현재 차례인 쪽을 패배 처리합니다.
 *
 * 양쪽 클라이언트가 각자 카운트다운을 돌리다 0이 되면 호출하므로 중복 호출이
 * 정상입니다. 실제 판정은 여기서 DB의 turn_started_at으로 다시 계산하고,
 * 확정은 finishRoomWithWinner의 status='playing' 조건이 한 번만 통과시킵니다.
 */
export async function timeoutTurn(
  roomId: string,
  userId: string,
): Promise<{ room: AlkkagiRoom } | { error: string }> {
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

/**
 * 샷 하나를 받아 결과를 확정합니다. 클라이언트가 보내는 건 "어느 돌을 어느
 * 속도로" 세 값뿐이고, 물리는 서버가 alkkagiPhysics로 다시 돌립니다.
 *
 * 다음 사람의 turn_started_at을 "지금"이 아니라 "돌이 다 멈추는 시각"(미래)
 * 으로 찍는 게 이 함수의 핵심입니다. 내가 쏘는 순간 상대 차례가 시작되는데
 * 상대 화면에서는 돌이 아직 굴러가는 중이라, 그대로 두면 상대는 구경만
 * 하다가 시간을 뺏깁니다. 서버는 시뮬레이션에서 정지 시각을 이미 알고
 * 있으므로 그만큼 시계를 뒤로 미룹니다.
 */
export async function submitShot(
  roomId: string,
  userId: string,
  shot: Shot,
): Promise<{ room: AlkkagiRoom } | { error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { error: "존재하지 않는 방이에요." };
  if (room.status !== "playing") return { error: "진행 중인 게임이 아니에요." };

  const isBlack = room.blackId === userId;
  const isWhite = room.whiteId === userId;
  if (!isBlack && !isWhite) return { error: "참여자만 칠 수 있어요." };

  const myColor: "black" | "white" = isBlack ? "black" : "white";
  if (room.turn !== myColor) return { error: "상대 차례예요." };

  const target = room.stones.find((stone) => stone.id === shot.stoneId);
  if (!target) return { error: "판에 없는 돌이에요." };
  if (target.owner !== myColor) return { error: "내 돌만 칠 수 있어요." };

  const speed = Math.hypot(shot.vx, shot.vy);
  if (!Number.isFinite(speed) || speed < MIN_SHOT_SPEED) {
    return { error: "너무 약해요. 조금 더 끌어서 쳐주세요." };
  }

  const clamped = clampShot({ stoneId: shot.stoneId, vx: shot.vx, vy: shot.vy });
  const result = simulateShot(room.stones, clamped);

  const blackLeft = result.stones.filter((stone) => stone.owner === "black").length;
  const whiteLeft = result.stones.filter((stone) => stone.owner === "white").length;
  const winner: Winner =
    blackLeft === 0 && whiteLeft === 0
      ? "draw"
      : whiteLeft === 0
        ? "black"
        : blackLeft === 0
          ? "white"
          : null;
  const finished = winner !== null;

  const supabase = getSupabase();
  if (!supabase) return { error: "서버 오류예요." };

  const now = new Date();
  const nowIso = now.toISOString();
  // 다음 사람의 시계는 돌이 다 멈춘 뒤부터 흐릅니다.
  const nextTurnStartedAt = new Date(now.getTime() + result.durationMs).toISOString();

  // 낙관적 동시성 제어: 읽어온 shot_seq와 지금 DB의 shot_seq가 다르면
  // (그 사이 다른 샷이나 시간 초과 처리가 먼저 끝났으면) 0행에 매치돼
  // 조용히 실패합니다. turn도 함께 걸어 같은 턴에 두 번 쏘는 걸 막습니다.
  const { data, error } = await supabase
    .from("alkkagi_rooms")
    .update({
      stones: result.stones,
      pre_shot_stones: room.stones,
      last_shot: clamped,
      last_shot_at: nowIso,
      shot_seq: room.shotSeq + 1,
      shot_count: room.shotCount + 1,
      turn: myColor === "black" ? "white" : "black",
      status: finished ? "finished" : "playing",
      winner,
      turn_started_at: finished ? null : nextTurnStartedAt,
      updated_at: nowIso,
    })
    .eq("id", roomId)
    .eq("shot_seq", room.shotSeq)
    .eq("turn", myColor)
    .select()
    .maybeSingle();

  if (error) {
    console.error("submitShot error:", error);
    return { error: "샷을 저장하지 못했어요." };
  }
  if (!data) return { error: "다른 수가 먼저 처리됐어요. 다시 시도해주세요." };

  const updatedRoom = mapRow(data as AlkkagiRoomRow);
  if (finished && updatedRoom.winner) {
    await recordMatchResult(updatedRoom, updatedRoom.winner);
  }
  return { room: updatedRoom };
}
