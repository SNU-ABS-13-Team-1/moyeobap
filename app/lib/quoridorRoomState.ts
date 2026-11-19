import { mapRoomRow, type QuoridorRoom, type QuoridorRoomRow } from './quoridorRoom';

// API 응답·실시간 이벤트·폴링이 하나의 최신 방 상태를 공유합니다(omokRoomState.ts와 같은 역할).
// 쿼리도 방은 모든 갱신이 version을 1씩 올리고 재시작해도 계속 오르므로 version만 비교합니다.

export type QuoridorRoomResponse = { room: QuoridorRoom };

const isCell = (v: unknown) => {
  const c = v as { r?: unknown; c?: unknown } | null;
  return !!c && Number.isInteger(c.r) && Number.isInteger(c.c);
};
const isWall = (v: unknown) => isCell(v) && ['h', 'v'].includes(String((v as { o?: unknown }).o));
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const nullableDate = (v: unknown) => v === null || date(v);

/** 불완전한 이벤트로 판의 일부만 덮어쓰지 않습니다. 실패하면 호출 쪽이 재조회합니다. */
export function parseQuoridorRoomEvent(value: unknown, roomId: string): QuoridorRoom | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const ok =
    row.id === roomId &&
    typeof row.room_name === 'string' &&
    typeof row.host_id === 'string' &&
    ['waiting', 'playing', 'finished'].includes(String(row.status)) &&
    (row.mode === 2 || row.mode === 4) &&
    (row.anonymous === undefined || typeof row.anonymous === 'boolean') &&
    Array.isArray(row.players) && row.players.every((p) => !!p && typeof (p as { id?: unknown }).id === 'string') &&
    Number.isInteger(row.turn_index) &&
    Array.isArray(row.pawns) && row.pawns.every(isCell) &&
    Array.isArray(row.walls) && row.walls.every(isWall) &&
    Array.isArray(row.walls_left) &&
    Array.isArray(row.moves) &&
    (row.winner_id === null || typeof row.winner_id === 'string') &&
    [null, 'goal', 'others_left'].includes(row.end_reason as string | null) &&
    Number.isInteger(row.turn_limit_sec) &&
    Number.isInteger(row.version) &&
    nullableDate(row.started_at) && nullableDate(row.turn_started_at) &&
    date(row.created_at) && date(row.updated_at);
  return ok ? mapRoomRow(row as unknown as QuoridorRoomRow) : null;
}

/** version이 큰 쪽이 최신입니다. 같으면 새로 들어온 것을 씁니다. */
export function newerQuoridorRoom(current: QuoridorRoom | undefined, incoming: QuoridorRoom): QuoridorRoom {
  if (!current || current.id !== incoming.id) return incoming;
  return incoming.version < current.version ? current : incoming;
}

/** SWR 조회·수 응답·실시간 이벤트가 하나의 최신 상태를 공유합니다. 겹치는 복구 조회는 하나로 합칩니다. */
export function createQuoridorRoomState(roomId: string) {
  let latest: QuoridorRoomResponse | undefined;
  let pending: Promise<QuoridorRoomResponse | undefined> | null = null;
  return {
    synchronize(read: () => Promise<QuoridorRoomResponse | undefined>) {
      if (!pending) pending = read().finally(() => { pending = null; });
      return pending;
    },
    accept(incoming: QuoridorRoom): QuoridorRoomResponse {
      if (incoming.id !== roomId) throw new Error('다른 방의 상태를 받았어요.');
      const room = newerQuoridorRoom(latest?.room, incoming);
      if (latest?.room !== room) latest = { room };
      return latest!;
    },
  };
}
