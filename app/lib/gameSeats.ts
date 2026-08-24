// 2인 실시간 게임(오목·체스·퐁)에서 "한 사람이 나갔을 때 방을 어떻게 할지"와
// "빈 자리에 누가 앉을 수 있는지"를 정하는 순수 규칙 모듈입니다. DB·렌더링과
// 무관해 세 게임이 같은 규칙을 그대로 재사용하고, 규칙 자체는 여기서만
// 검증합니다(app/lib/gameSeats.test.ts).
//
// 게임마다 자리 이름이 달라(오목 흑/백, 체스 백/흑, 퐁 1P/2P) 여기서는 방을
// 만든 사람의 자리를 host, 나중에 들어온 자리를 guest로만 부릅니다.
//
// 핵심 규칙: 한 사람이 나가도 방은 사라지지 않습니다. 나간 사람의 자리만
// 비우고, 남은 사람과 관전자는 그 방에 그대로 있습니다. 관전자가 빈 자리에
// 앉으면 다시 두 명이 되고, 재대국으로 새 판을 시작합니다. 방이 실제로
// 사라지는 때는 마지막 한 사람까지 나가 아무도 남지 않을 때뿐입니다.

export type SeatKey = "host" | "guest";

export type RoomSeats = {
  status: "waiting" | "playing" | "finished";
  hostId: string | null;
  guestId: string | null;
};

export type LeaveOutcome =
  /** 참여자가 아니라 아무 일도 하지 않습니다(관전자가 나가는 경우). */
  | { kind: "ignore" }
  /** 마지막 한 사람이 나가 방이 비었습니다. 방을 지웁니다. */
  | { kind: "delete" }
  /** 대국 중 이탈이라 기권패로 기록하고, 그 자리를 비웁니다. */
  | { kind: "resign"; seat: SeatKey }
  /** 대기·종료 상태에서의 이탈이라 자리만 비웁니다. */
  | { kind: "vacate"; seat: SeatKey };

export type SitOutcome =
  /** 빈 자리에 앉습니다. start가 true면 두 자리가 차서 바로 시작합니다. */
  | { kind: "sit"; seat: SeatKey; start: boolean }
  /** 이미 그 방의 참여자입니다. */
  | { kind: "self" }
  /** 앉을 자리가 없습니다(대국 중이거나 두 자리 모두 참). */
  | { kind: "full" };

export function seatOf(room: RoomSeats, userId: string): SeatKey | null {
  if (room.hostId === userId) return "host";
  if (room.guestId === userId) return "guest";
  return null;
}

export function resolveLeave(room: RoomSeats, userId: string): LeaveOutcome {
  const seat = seatOf(room, userId);
  if (!seat) return { kind: "ignore" };

  // 대국 중이라면 상대가 반드시 있으므로 방이 비지 않습니다.
  if (room.status === "playing") return { kind: "resign", seat };

  const otherOccupied = seat === "host" ? room.guestId !== null : room.hostId !== null;
  if (!otherOccupied) return { kind: "delete" };
  return { kind: "vacate", seat };
}

export function resolveSit(room: RoomSeats, userId: string): SitOutcome {
  if (seatOf(room, userId)) return { kind: "self" };
  // 진행 중인 대국에는 끼어들 수 없습니다(관전만 가능).
  if (room.status === "playing") return { kind: "full" };

  if (room.hostId === null) {
    return { kind: "sit", seat: "host", start: room.status === "waiting" && room.guestId !== null };
  }
  if (room.guestId === null) {
    return { kind: "sit", seat: "guest", start: room.status === "waiting" };
  }
  return { kind: "full" };
}
