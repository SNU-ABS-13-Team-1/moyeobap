import type { Tile, TileColor } from "./rummy";

// 루미큐브 온라인 대전의 "순수 규칙·타입" 모듈입니다. DB·렌더링과 독립된 것만 두어
// 서버(rummyOnline.ts)와 클라이언트(RummyRoom.tsx)가 같이 씁니다. 체스의 chessMatch.ts와 같은 역할이며,
// 서버 전용(server-only) 모듈을 클라이언트 컴포넌트가 끌어오지 않게 하는 경계입니다.

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const TURN_GRACE_MS = 3_000;

export type RoomStatus = "waiting" | "playing" | "finished";
export type EndReason = "empty_hand" | "stuck" | "others_left" | null;

export const END_REASON_LABEL: Record<NonNullable<EndReason>, string> = {
  empty_hand: "타일을 모두 냄",
  stuck: "더 낼 사람이 없음(벌점 최소)",
  others_left: "다른 참여자가 모두 나감",
};

export type RoomPlayer = {
  id: string;
  name: string;
  melded: boolean;
  tileCount: number;
  left: boolean;
  penalty?: number;
  score?: number;
};

export type RummyRoom = {
  id: string;
  roomName: string;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
  turnIndex: number;
  table: Tile[][];
  deckCount: number;
  passStreak: number;
  winnerId: string | null;
  endReason: EndReason;
  turnLimitSec: number;
  version: number;
  startedAt: string | null;
  turnStartedAt: string | null;
  createdAt: string;
};

/** 클라이언트가 보낸 타일은 믿지 않고 id로 다시 만듭니다(색·숫자 위조 방지). */
export function tileFromId(id: string): Tile | null {
  if (id === "joker-0" || id === "joker-1") return { id, joker: true };
  const m = /^(red|blue|black|orange)-(\d{1,2})-(0|1)$/.exec(id);
  if (!m) return null;
  const num = Number(m[2]);
  if (num < 1 || num > 13) return null;
  return { id, joker: false, color: m[1] as TileColor, num };
}

export function activePlayers(room: RummyRoom): RoomPlayer[] {
  return room.players.filter((p) => !p.left);
}

export function currentPlayer(room: RummyRoom): RoomPlayer | null {
  return room.players[room.turnIndex] ?? null;
}

export function isTurnExpired(room: RummyRoom, now: number): boolean {
  if (room.status !== "playing" || !room.turnStartedAt) return false;
  const started = Date.parse(room.turnStartedAt);
  if (Number.isNaN(started)) return false;
  return now - started >= room.turnLimitSec * 1000 + TURN_GRACE_MS;
}
