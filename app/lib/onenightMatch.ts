// 원나잇 인랑의 "순수 규칙·타입" 모듈입니다. DB·렌더링과 독립된 것만 두어
// 서버(onenightOnline.ts)와 클라이언트(OneNightRoom.tsx)가 같이 씁니다.
// 갈틱폰의 phoneMatch.ts, 체스의 chessMatch.ts와 같은 경계입니다.
//
// 게임의 뼈대
//  - 카드는 (인원 + 3)장. 남는 3장은 중앙에 깔립니다.
//  - 밤은 딱 한 번. 모두가 동시에 자기 행동을 고르고, 서버가 정해진 순서로 해소합니다.
//    실제 보드게임은 역할을 하나씩 깨우지만, 고르는 시점에 남의 결과를 알 필요가
//    전혀 없어서 동시에 받아도 결과가 똑같습니다. 대신 기다리는 시간이 사라집니다.
//  - 예언자는 도둑·말썽꾼보다 먼저 봅니다. 그래서 예언자의 정보가 낮에는 이미
//    낡아 있을 수 있습니다. 이 게임의 재미가 전부 여기서 나옵니다.

export const MIN_PLAYERS = 3;
export const RECOMMENDED_PLAYERS = 5;
export const MAX_PLAYERS = 8;
/** 중앙에 깔리는 카드는 항상 3장입니다. */
export const CENTER_COUNT = 3;

export type Role =
  | "werewolf"
  | "mason"
  | "seer"
  | "robber"
  | "troublemaker"
  | "drunk"
  | "insomniac"
  | "villager";

export type Team = "village" | "werewolf";

export const ROLE_LABEL: Record<Role, string> = {
  werewolf: "늑대인간",
  mason: "프리메이슨",
  seer: "예언자",
  robber: "도둑",
  troublemaker: "말썽꾼",
  drunk: "취객",
  insomniac: "불면증환자",
  villager: "마을사람",
};

export const ROLE_EMOJI: Record<Role, string> = {
  werewolf: "🐺",
  mason: "🤝",
  seer: "🔮",
  robber: "🧤",
  troublemaker: "🌀",
  drunk: "🍺",
  insomniac: "👀",
  villager: "🧑‍🌾",
};

/** 룰북과 밤 화면에 그대로 쓰는 한 줄 설명. */
export const ROLE_SUMMARY: Record<Role, string> = {
  werewolf: "밤에 같은 늑대가 누구인지 확인해요. 혼자면 중앙 카드 한 장을 봐요.",
  mason: "밤에 다른 프리메이슨이 누구인지 확인해요. 둘 다 없으면 혼자예요.",
  seer: "밤에 한 사람의 카드를 보거나, 중앙 카드 두 장을 봐요.",
  robber: "밤에 한 사람과 카드를 바꾸고, 새로 가진 카드를 확인해요.",
  troublemaker: "밤에 나를 뺀 두 사람의 카드를 서로 바꿔요. 내용은 못 봐요.",
  drunk: "밤에 중앙 카드 한 장과 내 카드를 바꿔요. 뭘 가져왔는지 못 봐요.",
  insomniac: "밤이 끝난 뒤 내 카드가 그대로인지 확인해요.",
  villager: "밤에는 아무것도 안 해요. 낮에 말로 승부해요.",
};

export function teamOf(role: Role): Team {
  return role === "werewolf" ? "werewolf" : "village";
}

/** 밤에 해소하는 순서. 여기 없는 역할은 밤에 아무 일도 하지 않습니다. */
export const NIGHT_ORDER: Role[] = [
  "werewolf",
  "mason",
  "seer",
  "robber",
  "troublemaker",
  "drunk",
  "insomniac",
];

// ── 덱 구성 ──────────────────────────────────────────────────────────
// 컴퓨터끼리 프리셋당 4만 판을 돌려 고른 구성입니다.
//  - 5인 추천 구성은 마을 46.5% : 늑대 47.0%로 거의 반반이었습니다.
//  - 마을사람 카드를 취객·불면증환자로 바꿀수록 균형이 좋아집니다. 검증할 수
//    있는 정보가 늘어 늑대가 "저는 마을사람인데요"로 숨기 어려워지기 때문입니다.
//  - 부하(Minion)는 인원과 무관하게 늑대 승률을 10%p 올려서 넣지 않았습니다.
const CORE: Role[] = ["seer", "robber", "troublemaker", "drunk", "insomniac"];

/** 인원별 덱. 항상 (인원 + 3)장입니다. */
export function deckFor(playerCount: number): Role[] {
  switch (playerCount) {
    case 3:
      return ["werewolf", "werewolf", "seer", "robber", "troublemaker", "villager"];
    case 4:
      return ["werewolf", "werewolf", "seer", "robber", "troublemaker", "drunk", "villager"];
    case 5:
      return ["werewolf", "werewolf", ...CORE, "villager"];
    case 6:
      return ["werewolf", "werewolf", ...CORE, "villager", "villager"];
    case 7:
      return ["werewolf", "werewolf", "mason", "mason", ...CORE, "villager"];
    case 8:
      return ["werewolf", "werewolf", "mason", "mason", ...CORE, "villager", "villager"];
    default:
      throw new Error(`${MIN_PLAYERS}~${MAX_PLAYERS}명만 가능해요.`);
  }
}

export type RoomStatus = "waiting" | "night" | "day" | "voting" | "finished";

export type RoomPlayer = {
  id: string;
  name: string;
  avatarUrl?: string;
  left: boolean;
};

export type RoomSettings = { nightSec: number; daySec: number; voteSec: number };

export const TIME_PRESETS: { key: string; label: string; settings: RoomSettings }[] = [
  { key: "normal", label: "보통 · 밤 45초 / 토론 3분 / 투표 30초", settings: { nightSec: 45, daySec: 180, voteSec: 30 } },
  { key: "fast", label: "빠르게 · 밤 30초 / 토론 90초 / 투표 20초", settings: { nightSec: 30, daySec: 90, voteSec: 20 } },
  { key: "relaxed", label: "느긋하게 · 밤 60초 / 토론 5분 / 투표 45초", settings: { nightSec: 60, daySec: 300, voteSec: 45 } },
];

/** 마감 뒤 이만큼은 늦은 제출을 받아줍니다(네트워크 지연). */
export const PHASE_GRACE_MS = 3_000;

export type OneNightRoom = {
  id: string;
  roomName: string;
  status: RoomStatus;
  hostId: string | null;
  players: RoomPlayer[];
  settings: RoomSettings;
  /** 밤 행동을 제출한 사람. 누가 아직 안 골랐는지만 공개합니다. */
  nightSubmitted: string[];
  /** 투표를 마친 사람. 누구를 찍었는지는 공개하지 않습니다. */
  voted: string[];
  /** 끝난 뒤에만 채워집니다. */
  result: GameResult | null;
  version: number;
  phaseStartedAt: string | null;
  createdAt: string;
};

// ── 밤 행동 ──────────────────────────────────────────────────────────

export type NightAction =
  | { kind: "seerPlayer"; seat: number }
  | { kind: "seerCenter"; cards: [number, number] }
  | { kind: "robber"; seat: number }
  | { kind: "troublemaker"; seats: [number, number] }
  | { kind: "drunk"; card: number }
  | { kind: "loneWolf"; card: number };

/** 이 역할이 밤에 골라야 하는 게 있는가. 없으면 화면에서 "확인만" 하면 됩니다. */
export function needsNightChoice(role: Role, wolfPartnerCount: number): boolean {
  if (role === "seer" || role === "robber" || role === "troublemaker" || role === "drunk") return true;
  if (role === "werewolf") return wolfPartnerCount === 0; // 혼자인 늑대만 중앙을 봅니다
  return false;
}

/** 밤에 각자가 알게 된 것. 낮에 이걸 근거로 말하고 투표합니다. */
export type NightKnowledge = {
  /** 늑대인간이 확인한 다른 늑대의 자리(자기 제외). */
  wolfPartners: number[];
  /** 혼자인 늑대가 본 중앙 카드 한 장. */
  loneWolfCenter?: { index: number; role: Role };
  /** 프리메이슨 동료 자리. 혼자면 빈 배열. */
  masonPartners: number[];
  /** 예언자가 본 것. */
  seerPeek?:
    | { kind: "player"; seat: number; role: Role }
    | { kind: "center"; cards: { index: number; role: Role }[] };
  /** 도둑이 훔친 상대와, 그 사람의 원래 카드. */
  robbed?: { seat: number; role: Role };
  /** 말썽꾼이 맞바꾼 두 자리(내용은 모릅니다). */
  swapped?: [number, number];
  /** 취객이 가져온 중앙 자리(내용은 모릅니다). */
  drunkTook?: number;
  /** 불면증환자가 밤이 끝난 뒤 확인한 자기 카드. */
  insomniaSaw?: Role;
};

export type NightResult = {
  finalRoles: Role[];
  finalCenter: Role[];
  knowledge: NightKnowledge[];
};

export interface Rng {
  int(n: number): number;
  shuffle<T>(items: T[]): T[];
}

/** 재현 가능한 난수(mulberry32). 테스트에서 같은 씨앗이면 같은 판이 나옵니다. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    int,
    shuffle: <T,>(items: T[]) => {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/** 카드를 섞어 나눠 줍니다. */
export function dealRoles(deck: Role[], playerCount: number, rng: Rng): { startRoles: Role[]; center: Role[] } {
  if (deck.length !== playerCount + CENTER_COUNT) {
    throw new Error(`카드가 ${deck.length}장입니다. ${playerCount + CENTER_COUNT}장이어야 합니다.`);
  }
  const shuffled = rng.shuffle(deck);
  return { startRoles: shuffled.slice(0, playerCount), center: shuffled.slice(playerCount) };
}

/**
 * 밤을 통째로 해소합니다.
 *
 * 행동의 주체는 언제나 "처음 받은 카드"입니다. 밤중에 내 카드가 바뀌어도
 * 내가 하는 행동은 바뀌지 않습니다. actions에 없는 자리는 아무것도 안 한 것으로
 * 칩니다(시간 초과). 단 취객은 반드시 바꿔야 해서 서버가 미리 채워 넣습니다.
 */
export function resolveNight(
  startRoles: Role[],
  startCenter: Role[],
  actions: (NightAction | null)[],
): NightResult {
  const board = startRoles.slice();
  const center = startCenter.slice();
  const knowledge: NightKnowledge[] = startRoles.map(() => ({ wolfPartners: [], masonPartners: [] }));

  const seatsWith = (role: Role) => startRoles.flatMap((r, i) => (r === role ? [i] : []));
  const wolfSeats = seatsWith("werewolf");
  const masonSeats = seatsWith("mason");
  const inRange = (n: unknown, max: number) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < max;

  for (const role of NIGHT_ORDER) {
    for (const seat of seatsWith(role)) {
      const action = actions[seat] ?? null;
      switch (role) {
        case "werewolf": {
          knowledge[seat].wolfPartners = wolfSeats.filter((s) => s !== seat);
          // 늑대가 혼자일 때만 중앙 한 장을 봅니다. "혼자"라는 사실 자체가 큰 정보입니다.
          if (wolfSeats.length === 1 && action?.kind === "loneWolf" && inRange(action.card, CENTER_COUNT)) {
            knowledge[seat].loneWolfCenter = { index: action.card, role: center[action.card] };
          }
          break;
        }
        case "mason": {
          knowledge[seat].masonPartners = masonSeats.filter((s) => s !== seat);
          break;
        }
        case "seer": {
          if (action?.kind === "seerPlayer" && inRange(action.seat, board.length) && action.seat !== seat) {
            knowledge[seat].seerPeek = { kind: "player", seat: action.seat, role: board[action.seat] };
          } else if (action?.kind === "seerCenter") {
            const [a, b] = action.cards;
            if (inRange(a, CENTER_COUNT) && inRange(b, CENTER_COUNT) && a !== b) {
              knowledge[seat].seerPeek = {
                kind: "center",
                cards: [a, b].map((i) => ({ index: i, role: center[i] })),
              };
            }
          }
          break;
        }
        case "robber": {
          if (action?.kind === "robber" && inRange(action.seat, board.length) && action.seat !== seat) {
            const target = action.seat;
            [board[seat], board[target]] = [board[target], board[seat]];
            knowledge[seat].robbed = { seat: target, role: board[seat] };
          }
          break;
        }
        case "troublemaker": {
          if (action?.kind === "troublemaker") {
            const [a, b] = action.seats;
            if (inRange(a, board.length) && inRange(b, board.length) && a !== b && a !== seat && b !== seat) {
              [board[a], board[b]] = [board[b], board[a]];
              knowledge[seat].swapped = [a, b];
            }
          }
          break;
        }
        case "drunk": {
          if (action?.kind === "drunk" && inRange(action.card, CENTER_COUNT)) {
            const idx = action.card;
            [board[seat], center[idx]] = [center[idx], board[seat]];
            knowledge[seat].drunkTook = idx;
          }
          break;
        }
        case "insomniac": {
          knowledge[seat].insomniaSaw = board[seat];
          break;
        }
      }
    }
  }

  return { finalRoles: board, finalCenter: center, knowledge };
}

// ── 투표와 승패 ───────────────────────────────────────────────────────

export type VoteOutcome = {
  /** 자리별 득표 수. */
  tally: number[];
  /** 투표로 죽은 사람. */
  votedOut: number[];
};

/**
 * 투표 결과를 판정합니다.
 *  - 최다 득표자가 죽습니다. 동점이면 동점자 전원이 죽습니다.
 *  - 아무도 2표 이상 못 받으면(전원 1표씩) 아무도 죽지 않습니다. 늑대가 전부
 *    중앙에 있다고 확신할 때 마을이 쓰는 정식 전술입니다.
 *  - votes[i]가 null이면 기권입니다(시간 초과). 아무 표도 안 갑니다.
 */
export function resolveVotes(votes: (number | null)[], playerCount: number): VoteOutcome {
  const tally = Array.from({ length: playerCount }, () => 0);
  for (const v of votes) {
    if (v !== null && v >= 0 && v < playerCount) tally[v] += 1;
  }
  const max = Math.max(0, ...tally);
  const votedOut = max < 2 ? [] : tally.flatMap((n, i) => (n === max ? [i] : []));
  return { tally, votedOut };
}

export type GameResult = {
  startRoles: Role[];
  finalRoles: Role[];
  center: Role[];
  finalCenter: Role[];
  votes: (number | null)[];
  tally: number[];
  dead: number[];
  winners: Team[];
  reason: string;
};

/**
 * 승패 판정.
 *  - 마을은 늑대가 한 명이라도 죽어야 이깁니다.
 *  - 늑대는 판에 늑대가 있고 아무 늑대도 안 죽으면 이깁니다.
 *  - 늑대가 전부 중앙에 깔렸으면, 아무도 죽지 않아야 마을이 이깁니다.
 *    애먼 사람을 죽이면 아무도 못 이깁니다.
 */
export function judge(finalRoles: Role[], dead: number[]): { winners: Team[]; reason: string } {
  const deadSet = new Set(dead);
  const wolfSeats = finalRoles.flatMap((r, i) => (r === "werewolf" ? [i] : []));
  const wolfDied = wolfSeats.some((s) => deadSet.has(s));

  if (wolfSeats.length === 0) {
    if (dead.length === 0) {
      return { winners: ["village"], reason: "늑대가 전부 중앙에 있었고, 아무도 죽이지 않았어요." };
    }
    return { winners: [], reason: "늑대가 한 명도 없었는데 애먼 사람을 죽였어요." };
  }
  if (wolfDied) return { winners: ["village"], reason: "늑대를 잡았어요." };
  return { winners: ["werewolf"], reason: "늑대가 살아남았어요." };
}

/** 남은 시간(ms). 시작 시각이 없으면 null. */
export function remainingMs(phaseStartedAt: string | null, seconds: number, now = Date.now()): number | null {
  if (!phaseStartedAt) return null;
  const end = new Date(phaseStartedAt).getTime() + seconds * 1000;
  return Math.max(0, end - now);
}
