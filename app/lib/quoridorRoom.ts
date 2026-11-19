import type { SupabaseClient } from '@supabase/supabase-js';
import {
  START,
  WALLS_PER_PLAYER,
  applyMove,
  formatMove,
  hasAnyLegalMove,
  parseNotation,
  type BoardState,
  type Cell,
  type Mode,
  type Wall,
} from './quoridorMatch';

// 쿼리도 방의 타입·행 매핑·상태 전이(순수 함수)입니다. ./supabase(server-only)를 import하지 않아
// node --test로 검증할 수 있고, 클라이언트 화면도 같은 타입을 씁니다.
// DB 접착은 quoridorOnline.ts가 "행 읽기 → plan* → updateRoomCas" 순서로 합니다.

export const MAX_PLAYERS = 4;
export const MAX_TIMEOUT_STRIKES = 3;
export const TURN_GRACE_MS = 3_000;
export const DEFAULT_TURN_LIMIT_SEC = 30;

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type EndReason = 'goal' | 'others_left' | null;

export const END_REASON_LABEL: Record<NonNullable<EndReason>, string> = {
  goal: '목표 변 도착',
  others_left: '다른 참여자가 모두 나감',
};

/**
 * seat는 시작 전 null, 시작 후 0..mode-1. 시작 후 players는 seat 순으로 정렬돼 turnIndex === seat.
 * rank는 등수(1이 최고). 목표 변에 도착한 사람은 위에서부터, 나간 사람은 아래에서부터 채우고,
 * 마지막까지 남은 한 명이 남은 최고 등수를 받습니다. 아직 경기 중이면 null(없던 옛 행도 null 취급).
 */
export type RoomPlayer = { id: string; name: string; seat: number | null; left: boolean; timeouts: number; rank?: number | null };
/** move: 표기("e2", "e3h") | 'pass'(수가 없어 자동 넘김) | 'timeout'. 매 수마다 행 전체가 실시간으로 나가므로 시각은 넣지 않습니다. */
export type MoveRecord = { seat: number; move: string };

export type QuoridorRoom = {
  id: string;
  roomName: string;
  status: RoomStatus;
  hostId: string;
  mode: Mode;
  /** 익명전: 게임 중에는 이름 대신 자리 색으로만 보입니다(끝나면 공개). */
  anonymous: boolean;
  players: RoomPlayer[];
  turnIndex: number;
  pawns: Cell[];
  walls: Wall[];
  wallsLeft: number[];
  moves: MoveRecord[];
  winnerId: string | null;
  endReason: EndReason;
  turnLimitSec: number;
  version: number;
  startedAt: string | null;
  turnStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoridorRoomRow = {
  id: string;
  room_name: string;
  status: RoomStatus;
  host_id: string;
  mode: Mode;
  anonymous?: boolean;
  players: RoomPlayer[];
  turn_index: number;
  pawns: Cell[];
  walls: Wall[];
  walls_left: number[];
  moves: MoveRecord[];
  winner_id: string | null;
  end_reason: EndReason;
  turn_limit_sec: number;
  version: number;
  started_at: string | null;
  turn_started_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomPatch = Partial<Omit<QuoridorRoomRow, 'id' | 'version' | 'created_at' | 'updated_at'>>;
export type Finished = { winnerId: string | null; reason: NonNullable<EndReason> };
export type Plan = { error: string } | { patch: RoomPatch; finished: Finished | null };

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function mapRoomRow(row: QuoridorRoomRow): QuoridorRoom {
  return {
    id: row.id,
    roomName: row.room_name,
    status: row.status,
    hostId: row.host_id,
    mode: row.mode === 4 ? 4 : 2,
    anonymous: row.anonymous === true,
    players: list<RoomPlayer>(row.players),
    turnIndex: row.turn_index ?? 0,
    pawns: list<Cell>(row.pawns),
    walls: list<Wall>(row.walls),
    wallsLeft: list<number>(row.walls_left),
    moves: list<MoveRecord>(row.moves),
    winnerId: row.winner_id ?? null,
    endReason: row.end_reason ?? null,
    turnLimitSec: row.turn_limit_sec,
    version: row.version,
    startedAt: row.started_at ?? null,
    turnStartedAt: row.turn_started_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** 자리 색 이름(0~3번). 화면 CSS의 --quoridor-seat-N 색과 같은 순서입니다. */
export const SEAT_COLOR_NAMES = ['빨강', '파랑', '노랑', '초록'] as const;

/**
 * 화면·채팅에 쓸 이름. 익명전은 게임 중 색 이름만, 끝나면 "색(이름)"으로 공개합니다.
 * 대기실(자리 배정 전)과 일반 방은 실제 이름입니다.
 */
export function playerLabel(room: Pick<QuoridorRoom, 'anonymous' | 'status' | 'players'>, seat: number): string {
  const player = room.players[seat];
  const name = player?.name ?? `${seat + 1}번`;
  if (!room.anonymous || room.status === 'waiting') return name;
  const color = SEAT_COLOR_NAMES[seat] ?? `${seat + 1}번`;
  return room.status === 'finished' ? `${color}(${name})` : color;
}

/** 도착한 4인전 말을 보드에서 뺄 때 쓰는 자리(어떤 칸과도 겹치지 않음). */
export const OFF_BOARD: Cell = { r: -1, c: -1 };

/** 아직 경기 중(나가지 않았고 순위도 없음)인지. 턴 순서·길 검사 대상입니다. */
export function isRacing(p: RoomPlayer): boolean {
  return !p.left && (p.rank ?? null) === null;
}

export function boardOf(room: QuoridorRoom): BoardState {
  return {
    mode: room.mode,
    pawns: room.pawns,
    walls: room.walls,
    wallsLeft: room.wallsLeft,
    active: room.players.map(isRacing),
  };
}

function unusedRanks(players: RoomPlayer[], mode: Mode): number[] {
  const used = new Set(players.map((p) => p.rank).filter((r): r is number => typeof r === 'number'));
  return Array.from({ length: mode }, (_, i) => i + 1).filter((r) => !used.has(r));
}

/**
 * 경기 중인 사람이 한 명 이하로 남으면 그 사람에게 남은 최고 등수를 주고 판을 끝냅니다.
 * 1위가 목표 변 도착으로 정해졌으면 'goal', 끝까지 남아서 1위가 됐으면 'others_left'.
 */
function settle(players: RoomPlayer[], mode: Mode): { players: RoomPlayer[]; finished: Finished | null } {
  const racing = players.filter(isRacing);
  if (racing.length > 1) return { players, finished: null };
  const hadWinner = players.some((p) => p.rank === 1);
  let settled = players;
  if (racing.length === 1) {
    const best = unusedRanks(players, mode)[0] ?? mode;
    settled = players.map((p) => (p.id === racing[0].id ? { ...p, rank: best } : p));
  }
  const winner = settled.find((p) => p.rank === 1) ?? null;
  return { players: settled, finished: { winnerId: winner?.id ?? null, reason: hadWinner ? 'goal' : 'others_left' } };
}

export function currentPlayer(room: QuoridorRoom): RoomPlayer | null {
  return room.players[room.turnIndex] ?? null;
}

export function isTurnExpired(room: QuoridorRoom, nowMs: number): boolean {
  if (room.status !== 'playing' || !room.turnStartedAt) return false;
  const started = Date.parse(room.turnStartedAt);
  if (Number.isNaN(started)) return false;
  return nowMs - started >= room.turnLimitSec * 1000 + TURN_GRACE_MS;
}

/**
 * from 다음 사람부터 시계 방향으로, 나가지 않았고 둘 수 있는 수가 있는 사람을 찾습니다.
 * 수가 없는 사람은 'pass'로 기록하고 건너뜁니다. 한 바퀴를 돌아도 없으면 from을 그대로 둡니다.
 */
function advance(players: RoomPlayer[], board: BoardState, from: number, moves: MoveRecord[]): { turnIndex: number; moves: MoveRecord[] } {
  const out = [...moves];
  const n = players.length;
  for (let step = 1; step <= n; step += 1) {
    const idx = (from + step) % n;
    if (!isRacing(players[idx])) continue;
    if (hasAnyLegalMove(board, idx)) return { turnIndex: idx, moves: out };
    out.push({ seat: idx, move: 'pass' });
  }
  return { turnIndex: from, moves: out };
}

function withActive(board: BoardState, players: RoomPlayer[]): BoardState {
  return { ...board, active: players.map(isRacing) };
}

function startPatch(room: QuoridorRoom, shuffle: <T>(xs: T[]) => T[], nowIso: string): Plan {
  const seated = shuffle(room.players.filter((p) => !p.left)).map((p, seat) => ({
    id: p.id,
    name: p.name,
    seat,
    left: false,
    timeouts: 0,
    rank: null,
  }));
  return {
    patch: {
      status: 'playing',
      players: seated,
      turn_index: 0,
      pawns: START[room.mode].map((c) => ({ ...c })),
      walls: [],
      walls_left: START[room.mode].map(() => WALLS_PER_PLAYER[room.mode]),
      moves: [],
      winner_id: null,
      end_reason: null,
      started_at: nowIso,
      turn_started_at: nowIso,
    },
    finished: null,
  };
}

export function planStart(room: QuoridorRoom, userId: string, shuffle: <T>(xs: T[]) => T[], nowIso: string): Plan {
  if (room.status !== 'waiting') return { error: '이미 시작했어요.' };
  if (room.hostId !== userId) return { error: '방장만 시작할 수 있어요.' };
  if (room.players.filter((p) => !p.left).length !== room.mode) return { error: `${room.mode}명이 모여야 시작할 수 있어요.` };
  return startPatch(room, shuffle, nowIso);
}

/** 끝난 방에서 다시 하기. 인원이 모자라면 나간 사람을 빼고 대기 상태로 돌려 새 사람을 받습니다. */
export function planRestart(room: QuoridorRoom, userId: string, shuffle: <T>(xs: T[]) => T[], nowIso: string): Plan {
  if (room.status !== 'finished') return { error: '끝난 방에서만 다시 시작할 수 있어요.' };
  if (room.hostId !== userId) return { error: '방장만 다시 시작할 수 있어요.' };
  const staying = room.players.filter((p) => !p.left);
  if (staying.length === room.mode) return startPatch(room, shuffle, nowIso);
  return {
    patch: {
      status: 'waiting',
      players: staying.map((p) => ({ id: p.id, name: p.name, seat: null, left: false, timeouts: 0, rank: null })),
      turn_index: 0,
      pawns: [],
      walls: [],
      walls_left: [],
      moves: [],
      winner_id: null,
      end_reason: null,
      started_at: null,
      turn_started_at: null,
    },
    finished: null,
  };
}

export function planTurn(room: QuoridorRoom, userId: string, notation: unknown, nowIso: string): Plan {
  if (room.status !== 'playing') return { error: '진행 중인 게임이 아니에요.' };
  const me = currentPlayer(room);
  if (!me || me.id !== userId || !isRacing(me)) return { error: '내 차례가 아니에요.' };
  const move = typeof notation === 'string' ? parseNotation(notation) : null;
  if (!move) return { error: '잘못된 수예요.' };

  const seat = room.turnIndex;
  const result = applyMove(boardOf(room), seat, move);
  if (!result.ok) return { error: move.kind === 'pawn' ? '갈 수 없는 칸이에요.' : '벽을 놓을 수 없어요.' };

  let players = room.players.map((p, i) => (i === seat ? { ...p, timeouts: 0 } : p));
  const moves = [...room.moves, { seat, move: formatMove(move) }];
  let pawns = result.board.pawns;

  if (result.won) {
    // 도착한 사람은 남은 최고 등수를 받습니다. 판이 이어지면(4인전) 말을 보드에서 빼 길을 비웁니다.
    const rank = unusedRanks(players, room.mode)[0] ?? 1;
    players = players.map((p, i) => (i === seat ? { ...p, rank } : p));
    const settled = settle(players, room.mode);
    if (settled.finished) {
      return {
        patch: {
          pawns, walls: result.board.walls, walls_left: result.board.wallsLeft, players: settled.players, moves,
          status: 'finished', winner_id: settled.finished.winnerId, end_reason: settled.finished.reason, turn_started_at: null,
        },
        finished: settled.finished,
      };
    }
    pawns = pawns.map((c, i) => (i === seat ? { ...OFF_BOARD } : c));
  }
  const board = { ...result.board, pawns, active: players.map(isRacing) };
  const next = advance(players, board, seat, moves);
  return {
    patch: { pawns, walls: result.board.walls, walls_left: result.board.wallsLeft, players, moves: next.moves, turn_index: next.turnIndex, turn_started_at: nowIso },
    finished: null,
  };
}

export function planResign(room: QuoridorRoom, userId: string, nowIso: string): Plan {
  if (room.status !== 'playing') return { error: '진행 중인 게임이 아니에요.' };
  const leaver = room.players.find((p) => p.id === userId && !p.left);
  if (!leaver) return { error: '이미 나간 사람이에요.' };

  // 이미 도착해 순위가 있는 사람은 자리만 비웁니다. 경기 중이던 사람은 아래에서부터 등수를 받습니다.
  const rank = isRacing(leaver) ? (unusedRanks(room.players, room.mode).at(-1) ?? room.mode) : leaver.rank;
  const marked = room.players.map((p) => (p.id === userId ? { ...p, left: true, rank } : p));
  const stayingIds = marked.filter((p) => !p.left);
  const hostId = room.hostId === userId ? (stayingIds[0]?.id ?? room.hostId) : room.hostId;

  if (!isRacing(leaver)) return { patch: { players: marked, host_id: hostId }, finished: null };

  const settled = settle(marked, room.mode);
  const players = settled.players;
  if (settled.finished) {
    return {
      patch: {
        players, host_id: hostId, status: 'finished', winner_id: settled.finished.winnerId,
        end_reason: settled.finished.reason, turn_started_at: null,
      },
      finished: settled.finished,
    };
  }
  if (currentPlayer(room)?.id !== userId) return { patch: { players, host_id: hostId }, finished: null };
  const next = advance(players, withActive(boardOf(room), players), room.turnIndex, room.moves);
  return { patch: { players, host_id: hostId, turn_index: next.turnIndex, moves: next.moves, turn_started_at: nowIso }, finished: null };
}

/** 제한 시간 초과 신고. 누구든(참여자) 알려오면 시각을 다시 확인하고 현재 차례를 넘깁니다. */
export function planTimeout(room: QuoridorRoom, userId: string, nowMs: number, nowIso: string): Plan {
  if (room.status !== 'playing') return { error: '진행 중인 게임이 아니에요.' };
  if (!room.players.some((p) => p.id === userId)) return { error: '참여자만 할 수 있어요.' };
  if (!isTurnExpired(room, nowMs)) return { error: '아직 시간이 남아 있어요.' };
  const current = currentPlayer(room);
  if (!current) return { error: '차례 정보를 찾을 수 없어요.' };

  if (!isRacing(current)) {
    // 정상적으로는 생기지 않는 방어 경로: 나간 사람에게 벌점을 주지 않고 넘기기만 합니다.
    const next = advance(room.players, boardOf(room), room.turnIndex, room.moves);
    return { patch: { players: room.players, turn_index: next.turnIndex, moves: next.moves, turn_started_at: nowIso }, finished: null };
  }

  const strikes = current.timeouts + 1;
  if (strikes >= MAX_TIMEOUT_STRIKES) return planResign(room, current.id, nowIso);

  const players = room.players.map((p, i) => (i === room.turnIndex ? { ...p, timeouts: strikes } : p));
  const moves = [...room.moves, { seat: room.turnIndex, move: 'timeout' }];
  const next = advance(players, boardOf(room), room.turnIndex, moves);
  return { patch: { players, turn_index: next.turnIndex, moves: next.moves, turn_started_at: nowIso }, finished: null };
}

/** 시간 초과 신고가 실패했을 때 다시 보낼 때까지 기다릴 시간(ms). 실패 종류와 상관없이 늘려 가며 몇 번만 다시 보내고, 끝나면 null. */
export function timeoutRetryDelay(failures: number): number | null {
  return failures < 4 ? 2000 * 2 ** failures : null;
}

/** version 조건부 갱신. 다른 요청이 먼저 바꿨으면 null, DB 오류면 예외(충돌과 구분하기 위해). */
export async function updateRoomCas(db: SupabaseClient, room: QuoridorRoom, patch: RoomPatch, nowIso: string): Promise<QuoridorRoom | null> {
  const { data, error } = await db
    .from('quoridor_rooms')
    .update({ ...patch, version: room.version + 1, updated_at: nowIso })
    .eq('id', room.id)
    .eq('version', room.version)
    .select()
    .maybeSingle();
  if (error) {
    console.error('quoridor updateRoomCas error:', error);
    throw new Error(`quoridor updateRoomCas failed: ${error.message}`);
  }
  return data ? mapRoomRow(data as QuoridorRoomRow) : null;
}
