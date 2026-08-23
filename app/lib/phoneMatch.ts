// 갈틱폰의 "순수 규칙·타입" 모듈입니다. DB·렌더링과 독립된 것만 두어 서버(phoneOnline.ts)와
// 클라이언트(PhoneRoom.tsx)가 같이 씁니다. 체스의 chessMatch.ts·루미큐브의 rummyMatch.ts와 같은 경계입니다.

export const MIN_PLAYERS = 3;
export const RECOMMENDED_PLAYERS = 4;
export const MAX_PLAYERS = 10;
/** 마감 뒤 이만큼은 늦은 제출을 받아줍니다(네트워크 지연). 그 뒤엔 빈 칸으로 채웁니다. */
export const TURN_GRACE_MS = 3_000;
export const MAX_TEXT_LENGTH = 80;
/** 800×450 PNG 낙서는 보통 10~60KB. 이 이상은 받지 않습니다. */
export const MAX_IMAGE_BYTES = 400_000;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 450;

export type RoomStatus = "waiting" | "playing" | "presenting";
export type EntryKind = "text" | "draw";
export type EntryStatus = "ok" | "timeout" | "left";

export type RoomPlayer = {
  id: string;
  name: string;
  avatarUrl?: string;
  left: boolean;
};

export type RoomSettings = { writeSec: number; drawSec: number };

export const TIME_PRESETS: { key: string; label: string; settings: RoomSettings }[] = [
  { key: "normal", label: "보통 · 글 40초 / 그림 90초", settings: { writeSec: 40, drawSec: 90 } },
  { key: "fast", label: "빠르게 · 글 20초 / 그림 45초", settings: { writeSec: 20, drawSec: 45 } },
  { key: "relaxed", label: "느긋하게 · 글 60초 / 그림 150초", settings: { writeSec: 60, drawSec: 150 } },
];

export type PhoneRoom = {
  id: string;
  roomName: string;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
  settings: RoomSettings;
  turn: number;
  totalTurns: number;
  submitted: string[];
  reveal: { album: number; step: number };
  version: number;
  startedAt: string | null;
  turnStartedAt: string | null;
  createdAt: string;
};

/** 앨범 한 칸(공개된 것만 클라이언트로 내려갑니다). */
export type AlbumEntry = {
  turn: number;
  kind: EntryKind;
  authorId: string;
  authorName: string;
  text: string | null;
  image: string | null;
  status: EntryStatus;
};

/** 홀수 턴 = 글, 짝수 턴 = 그림. */
export function turnKind(turn: number): EntryKind {
  return turn % 2 === 1 ? "text" : "draw";
}

/**
 * 총 턴 수. 앨범은 항상 글로 끝나게 합니다(처음 문장과 마지막 문장을 비교하는 게 가장 웃기므로).
 * 인원이 홀수면 전원이 한 번씩, 짝수면 한 명씩 덜 거칩니다(N−1턴).
 */
export function totalTurnsFor(playerCount: number): number {
  return playerCount % 2 === 1 ? playerCount : playerCount - 1;
}

/**
 * 턴 t(1부터)에 플레이어 i(0부터)가 작업하는 앨범의 주인 인덱스.
 * 같은 턴에 앨범이 겹치지 않고, 한 사람이 같은 앨범을 두 번 받지 않습니다. 첫 턴은 자기 앨범입니다.
 */
export function albumIndexFor(playerIndex: number, turn: number, playerCount: number): number {
  return (playerIndex + turn - 1) % playerCount;
}

/** 턴 t에 앨범 a를 맡은 플레이어 인덱스(위 공식의 역함수). */
export function playerIndexForAlbum(albumIndex: number, turn: number, playerCount: number): number {
  return (((albumIndex - (turn - 1)) % playerCount) + playerCount) % playerCount;
}

export function turnLimitSec(settings: RoomSettings, turn: number): number {
  return turnKind(turn) === "text" ? settings.writeSec : settings.drawSec;
}

export function isTurnExpired(room: PhoneRoom, now: number): boolean {
  if (room.status !== "playing" || !room.turnStartedAt) return false;
  const started = Date.parse(room.turnStartedAt);
  if (Number.isNaN(started)) return false;
  return now - started >= turnLimitSec(room.settings, room.turn) * 1000 + TURN_GRACE_MS;
}

export function activePlayers(room: PhoneRoom): RoomPlayer[] {
  return room.players.filter((p) => !p.left);
}

/** 첫 문장이 떠오르지 않을 때 쓰는 랜덤 문장. */
export const PROMPT_IDEAS = [
  "고양이가 배달 오토바이를 타고 시흥캠퍼스로 온다",
  "교수님이 점심시간에 치킨을 숨기고 있다",
  "커피를 너무 마셔서 날아가는 대학원생",
  "배달비를 아끼려고 자전거로 출발한 팟장",
  "해적이 요가 수업을 듣는다",
  "공룡이 마라탕 주문을 고민 중이다",
  "빗속에서 피자 박스로 우산을 만든 사람",
  "로봇이 김밥을 말다가 울고 있다",
  "학교 앞 카페에서 고백하는 펭귄",
  "마감 10초 전에 참여 버튼을 누르는 손",
  "달에서 떡볶이를 먹는 우주인",
  "수업 중에 몰래 라면을 끓이는 학생",
];
