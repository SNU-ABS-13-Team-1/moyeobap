/**
 * 미니게임 현황판(/games 하단)에 쓰는 통합 방 목록.
 *
 * 게임마다 방 구조가 제각각입니다 — 오목·체스는 자리가 두 칸으로 고정이고,
 * 루미큐브·갈틱폰은 players 배열에 여러 명이 들어갑니다. 방 주소도 체스와
 * 루미큐브만 /online/ 이 끼어 있습니다. 그 차이를 여기서 한 번만 흡수해서
 * 화면 쪽은 게임 종류를 몰라도 되게 만듭니다.
 *
 * 참여/관전 판단 규칙은 GameLobby와 같습니다(빈 자리가 있고 내가 이미 낀
 * 방이 아니면 참여, 그 밖에는 바로 입장).
 *
 * omokMatch.ts처럼 다른 모듈을 부르지 않는 순수 모듈로 둡니다(그래야
 * node --test가 그대로 돌립니다). 그래서 정원만 아래에 다시 적어두는데,
 * 원본과 어긋나면 openRooms.test.ts가 바로 잡아냅니다.
 */

export type OpenRoomGame = "omok" | "chess" | "rummy" | "phone";

export type OpenRoomStatus = "waiting" | "playing" | "presenting";

export type OpenRoom = {
  game: OpenRoomGame;
  gameLabel: string;
  emoji: string;
  id: string;
  roomName: string;
  status: OpenRoomStatus;
  playerCount: number;
  maxPlayers: number;
  hasOpenSeat: boolean;
  hostId: string;
  /** 이미 이 방에 들어가 있는 사람들. 화면에서 "입장하기" 표시에 씁니다. */
  memberIds: string[];
  /** 목록에 덧붙일 게임별 설정 한 줄(예: 턴당 90초). */
  meta: string | null;
  href: string;
  joinApi: string;
  createdAt: string;
};

/** 한 번에 보여줄 방 개수. 각 게임의 listRooms()는 30개까지 내려줍니다. */
export const MAX_OPEN_ROOMS = 20;

/** rummyMatch.MAX_PLAYERS 와 같아야 합니다. */
export const RUMMY_MAX_PLAYERS = 4;
/** phoneMatch.MAX_PLAYERS 와 같아야 합니다. */
export const PHONE_MAX_PLAYERS = 10;

const GAME_LABEL: Record<OpenRoomGame, { label: string; emoji: string }> = {
  omok: { label: "오목", emoji: "⚫" },
  chess: { label: "체스", emoji: "♟️" },
  rummy: { label: "루미큐브", emoji: "🀄" },
  phone: { label: "갈틱폰", emoji: "📞" },
};

/** 방 주소는 체스·루미큐브만 /online/ 이 한 칸 더 들어갑니다. */
const PAGE_PATH: Record<OpenRoomGame, string> = {
  omok: "/games/omok",
  chess: "/games/chess/online",
  rummy: "/games/rummy/online",
  phone: "/games/phone",
};

type Seat = { id: string; name: string; left: boolean };

type OmokLike = {
  id: string;
  roomName: string;
  status: string;
  blackId: string;
  whiteId: string | null;
  createdAt: string;
};

type ChessLike = {
  id: string;
  roomName: string;
  status: string;
  whiteId: string;
  blackId: string | null;
  timeControl: string;
  createdAt: string;
};

type RummyLike = {
  id: string;
  roomName: string;
  status: string;
  hostId: string;
  players: Seat[];
  turnLimitSec: number;
  createdAt: string;
};

type PhoneLike = {
  id: string;
  roomName: string;
  status: string;
  hostId: string;
  players: Seat[];
  settings: { writeSec: number; drawSec: number };
  createdAt: string;
};

function base(game: OpenRoomGame, id: string): Pick<OpenRoom, "game" | "gameLabel" | "emoji" | "href" | "joinApi"> {
  return {
    game,
    gameLabel: GAME_LABEL[game].label,
    emoji: GAME_LABEL[game].emoji,
    href: `${PAGE_PATH[game]}/${id}`,
    joinApi: `/api/games/${game}/rooms/${id}/join`,
  };
}

/** 나간 사람은 인원수에도 명단에도 넣지 않습니다(GameLobby와 같은 규칙). */
function staying(players: Seat[]): Seat[] {
  return players.filter((player) => !player.left);
}

export function fromOmok(room: OmokLike): OpenRoom {
  const seated = [room.blackId, room.whiteId].filter((id): id is string => Boolean(id));
  return {
    ...base("omok", room.id),
    id: room.id,
    roomName: room.roomName,
    status: room.status as OpenRoomStatus,
    playerCount: seated.length,
    maxPlayers: 2,
    hasOpenSeat: room.status === "waiting" && !room.whiteId,
    hostId: room.blackId,
    memberIds: seated,
    meta: null,
    createdAt: room.createdAt,
  };
}

/**
 * 체스만 시간제 라벨이 chessMatch.TIME_CONTROL_LABEL 에 있습니다. 이 모듈을
 * 순수하게 두려고 여기서는 라벨을 만들지 않고, 라우트가 넘겨주면 씁니다.
 */
export function fromChess(room: ChessLike, timeControlLabel?: string | null): OpenRoom {
  const seated = [room.whiteId, room.blackId].filter((id): id is string => Boolean(id));
  return {
    ...base("chess", room.id),
    id: room.id,
    roomName: room.roomName,
    status: room.status as OpenRoomStatus,
    playerCount: seated.length,
    maxPlayers: 2,
    hasOpenSeat: room.status === "waiting" && !room.blackId,
    hostId: room.whiteId,
    memberIds: seated,
    meta: timeControlLabel ?? null,
    createdAt: room.createdAt,
  };
}

export function fromRummy(room: RummyLike): OpenRoom {
  const here = staying(room.players);
  return {
    ...base("rummy", room.id),
    id: room.id,
    roomName: room.roomName,
    status: room.status as OpenRoomStatus,
    playerCount: here.length,
    maxPlayers: RUMMY_MAX_PLAYERS,
    hasOpenSeat: room.status === "waiting" && room.players.length < RUMMY_MAX_PLAYERS,
    hostId: room.hostId,
    memberIds: here.map((player) => player.id),
    meta: `턴당 ${room.turnLimitSec}초`,
    createdAt: room.createdAt,
  };
}

export function fromPhone(room: PhoneLike): OpenRoom {
  const here = staying(room.players);
  return {
    ...base("phone", room.id),
    id: room.id,
    roomName: room.roomName,
    status: room.status as OpenRoomStatus,
    playerCount: here.length,
    maxPlayers: PHONE_MAX_PLAYERS,
    hasOpenSeat: room.status === "waiting" && room.players.length < PHONE_MAX_PLAYERS,
    hostId: room.hostId,
    memberIds: here.map((player) => player.id),
    meta: `글 ${room.settings.writeSec}초 · 그림 ${room.settings.drawSec}초`,
    createdAt: room.createdAt,
  };
}

const OPEN_STATUSES = new Set(["waiting", "playing", "presenting"]);

export type RoomsByGame = {
  omok: OmokLike[];
  chess: ChessLike[];
  rummy: RummyLike[];
  phone: PhoneLike[];
};

/** 체스 시간제 라벨을 붙이는 함수. 라우트가 chessMatch에서 가져와 넘깁니다. */
export type MergeOptions = { chessTimeLabel?: (timeControl: string) => string | null };

export function mergeOpenRooms(rooms: RoomsByGame, options: MergeOptions = {}): OpenRoom[] {
  return [
    ...rooms.omok.map(fromOmok),
    ...rooms.chess.map((room) => fromChess(room, options.chessTimeLabel?.(room.timeControl))),
    ...rooms.rummy.map(fromRummy),
    ...rooms.phone.map(fromPhone),
  ]
    // 갈틱폰의 listRooms()에는 status 필터가 없어 끝난 방까지 섞여 옵니다.
    .filter((room) => OPEN_STATUSES.has(room.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_OPEN_ROOMS);
}
