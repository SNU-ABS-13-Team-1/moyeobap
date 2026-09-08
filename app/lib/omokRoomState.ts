/** API 응답과 Postgres Changes가 같은 판·차례·시계 스냅샷을 사용합니다. */
export type Stone = 'black' | 'white' | null;
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type Winner = 'black' | 'white' | 'draw' | null;

export type OmokRoom = {
  id: string;
  status: RoomStatus;
  roomName: string;
  blackId: string | null;
  blackName: string | null;
  whiteId: string | null;
  whiteName: string | null;
  board: Stone[][];
  turn: 'black' | 'white';
  winner: Winner;
  moveCount: number;
  lastRow: number | null;
  lastCol: number | null;
  startedAt: string | null;
  turnStartedAt: string | null;
  rematchBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OmokRoomRow = {
  id: string;
  status: RoomStatus;
  room_name: string;
  black_id: string | null;
  black_name: string | null;
  white_id: string | null;
  white_name: string | null;
  board: Stone[][];
  turn: 'black' | 'white';
  winner: Winner;
  move_count: number;
  last_row: number | null;
  last_col: number | null;
  started_at: string | null;
  turn_started_at: string | null;
  rematch_by: string | null;
  created_at: string;
  updated_at: string;
};
export type OmokRoomResponse = { room: OmokRoom };

export function mapOmokRoomRow(row: OmokRoomRow): OmokRoom {
  return {
    id: row.id, status: row.status, roomName: row.room_name,
    blackId: row.black_id, blackName: row.black_name,
    whiteId: row.white_id, whiteName: row.white_name,
    board: row.board, turn: row.turn, winner: row.winner,
    moveCount: row.move_count, lastRow: row.last_row, lastCol: row.last_col,
    startedAt: row.started_at, turnStartedAt: row.turn_started_at,
    rematchBy: row.rematch_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/** 불완전한 이벤트로 판의 일부만 덮어쓰지 않습니다. 실패하면 한 번 재조회합니다. */
export function parseOmokRoomEvent(value: unknown, roomId: string): OmokRoom | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const nullableString = (v: unknown) => v === null || typeof v === 'string';
  const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  const coordinate = (v: unknown) => v === null || (Number.isInteger(v) && Number(v) >= 0 && Number(v) < 15);
  if (row.id !== roomId || typeof row.room_name !== 'string' ||
      !['waiting', 'playing', 'finished'].includes(String(row.status)) ||
      !['black', 'white'].includes(String(row.turn)) ||
      ![null, 'black', 'white', 'draw'].includes(row.winner as Winner) ||
      !Number.isInteger(row.move_count) || Number(row.move_count) < 0 ||
      !coordinate(row.last_row) || !coordinate(row.last_col) ||
      !['black_id', 'black_name', 'white_id', 'white_name', 'rematch_by'].every(key => nullableString(row[key])) ||
      !date(row.created_at) || !date(row.updated_at) ||
      !(row.started_at === null || date(row.started_at)) ||
      !(row.turn_started_at === null || date(row.turn_started_at)) ||
      !Array.isArray(row.board) || row.board.length !== 15 ||
      !row.board.every(line => Array.isArray(line) && line.length === 15 && line.every(cell => cell === null || cell === 'black' || cell === 'white'))) {
    return null;
  }
  return mapOmokRoomRow(row as OmokRoomRow);
}

const time = (value: string | null | undefined) => value ? Date.parse(value) : 0;

/**
 * 재대국은 moveCount가 0으로 돌아가므로 대국 시작 시각부터 비교합니다.
 * 같은 대국에서는 착수 번호·종료 상태를 우선해 늦은 HTTP 응답이 판을 되돌리지
 * 못하게 하고, 같은 착수의 재대국 신청/좌석 변경은 updated_at으로 비교합니다.
 */
export function newerOmokRoom(current: OmokRoom | undefined, incoming: OmokRoom): OmokRoom {
  if (!current || current.id !== incoming.id) return incoming;
  const roundDifference = time(incoming.startedAt) - time(current.startedAt);
  if (roundDifference !== 0) return roundDifference > 0 ? incoming : current;
  if (incoming.moveCount !== current.moveCount) return incoming.moveCount > current.moveCount ? incoming : current;
  if (current.status === 'finished' && incoming.status !== 'finished') return current;
  if (incoming.status === 'finished' && current.status !== 'finished') return incoming;
  return time(incoming.updatedAt) < time(current.updatedAt) ? current : incoming;
}

/** SWR 조회·착수 응답·실시간 이벤트가 하나의 최신 상태를 공유합니다. */
export function createOmokRoomState(roomId: string) {
  let latest: OmokRoomResponse | undefined;
  let pending: Promise<OmokRoomResponse | undefined> | null = null;
  return {
    synchronize(read: () => Promise<OmokRoomResponse | undefined>) {
      if (!pending) pending = read().finally(() => { pending = null; });
      return pending;
    },
    accept(incoming: OmokRoom): OmokRoomResponse {
      if (incoming.id !== roomId) throw new Error('다른 방의 상태를 받았어요.');
      const room = newerOmokRoom(latest?.room, incoming);
      if (latest?.room !== room) latest = { room };
      return latest!;
    },
  };
}
