// 루미큐브 표준 규칙 — 순수 함수 모듈(렌더링·DB 무관).
// 타일 106장(1~13 × 4색 × 2벌 + 조커 2장), 각자 14장으로 시작, 첫 등록은 자기 타일만으로 30점 이상,
// 세트 = 그룹(같은 숫자·다른 색 3~4장) 또는 런(같은 색·연속 숫자 3장 이상, 1~13 안에서만).

export type TileColor = 'red' | 'blue' | 'black' | 'orange';
export const COLORS: TileColor[] = ['red', 'blue', 'black', 'orange'];
export const COLOR_LABEL: Record<TileColor, string> = { red: '빨강', blue: '파랑', black: '검정', orange: '주황' };

export type Tile =
  | { id: string; joker: false; color: TileColor; num: number }
  | { id: string; joker: true; color?: undefined; num?: undefined };

export const HAND_SIZE = 14;
export const INITIAL_MELD = 30;
/** 끝났을 때 남은 조커의 벌점. */
export const JOKER_PENALTY = 30;

export function createDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let copy = 0; copy < 2; copy += 1) {
    for (const color of COLORS) {
      for (let num = 1; num <= 13; num += 1) {
        deck.push({ id: `${color}-${num}-${copy}`, joker: false, color, num });
      }
    }
  }
  deck.push({ id: 'joker-0', joker: true });
  deck.push({ id: 'joker-1', joker: true });
  return shuffle(deck);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sortTiles(tiles: Tile[], by: 'color' | 'num'): Tile[] {
  const colorRank = (t: Tile) => (t.joker ? 99 : COLORS.indexOf(t.color));
  const numRank = (t: Tile) => (t.joker ? 99 : t.num);
  return [...tiles].sort((a, b) =>
    by === 'color' ? colorRank(a) - colorRank(b) || numRank(a) - numRank(b) : numRank(a) - numRank(b) || colorRank(a) - colorRank(b),
  );
}

export type SetCheck =
  | { valid: true; kind: 'group' | 'run'; value: number; values: number[] }
  | { valid: false; reason: string };

/**
 * 타일 묶음 하나가 올바른 세트인지 판정합니다. 조커는 빈 자리를 대신하고, 점수는 대신한 타일의 값으로 칩니다.
 * `values`는 각 타일(순서대로)이 나타내는 숫자입니다.
 */
export function checkSet(tiles: Tile[]): SetCheck {
  if (tiles.length < 3) return { valid: false, reason: '세트는 3장 이상이어야 해요.' };
  const plain = tiles.filter((t): t is Extract<Tile, { joker: false }> => !t.joker);
  if (plain.length === 0) return { valid: false, reason: '조커만으로는 세트를 만들 수 없어요.' };

  // 그룹·런 둘 다 될 수 있는 경우(예: 빨강7 + 조커 2장)는 점수가 높은 해석을 씁니다.
  const group = checkGroup(tiles, plain);
  const run = checkRun(tiles, plain);
  if (group.valid && run.valid) return run.value >= group.value ? run : group;
  if (group.valid) return group;
  if (run.valid) return run;
  // 둘 다 아니면 더 그럴듯한 쪽의 이유를 알려줍니다.
  const sameNum = plain.every((t) => t.num === plain[0].num);
  return sameNum ? group : run;
}

function checkGroup(tiles: Tile[], plain: Extract<Tile, { joker: false }>[]): SetCheck {
  const sameNum = plain.every((t) => t.num === plain[0].num);
  if (!sameNum) return { valid: false, reason: '그룹은 같은 숫자여야 해요.' };
  const distinctColors = new Set(plain.map((t) => t.color)).size === plain.length;
  if (!distinctColors) return { valid: false, reason: '그룹은 색이 모두 달라야 해요.' };
  if (tiles.length > 4) return { valid: false, reason: '그룹은 4장까지예요.' };
  return { valid: true, kind: 'group', value: plain[0].num * tiles.length, values: tiles.map(() => plain[0].num) };
}

function checkRun(tiles: Tile[], plain: Extract<Tile, { joker: false }>[]): SetCheck {
  const jokers = tiles.length - plain.length;
  const sameColor = plain.every((t) => t.color === plain[0].color);
  if (!sameColor) return { valid: false, reason: '런은 같은 색이어야 해요.' };
  const nums = plain.map((t) => t.num).sort((a, b) => a - b);
  if (new Set(nums).size !== nums.length) return { valid: false, reason: '같은 색·같은 숫자가 겹쳤어요.' };
  const min = nums[0];
  const max = nums[nums.length - 1];
  const span = max - min + 1;
  const gaps = span - nums.length;
  if (gaps > jokers) return { valid: false, reason: '숫자가 이어지지 않아요.' };
  const extra = jokers - gaps;
  if (span + extra > 13) return { valid: false, reason: '런은 1부터 13까지만 가능해요.' };
  // 남는 조커는 위쪽(큰 숫자)부터 붙이고, 모자라면 아래쪽에 붙입니다(점수에 유리한 쪽).
  const up = Math.min(extra, 13 - max);
  const down = extra - up;
  if (down > min - 1) return { valid: false, reason: '런은 1부터 13까지만 가능해요.' };
  const start = min - down;
  const end = max + up;
  const jokerSlots: number[] = [];
  for (let n = start; n <= end; n += 1) if (!nums.includes(n)) jokerSlots.push(n);
  let jokerIdx = 0;
  const values = tiles.map((t) => (t.joker ? (jokerSlots[jokerIdx++] ?? 0) : t.num));
  return { valid: true, kind: 'run', value: values.reduce((a, b) => a + b, 0), values };
}

/** 런은 숫자 오름차순, 그룹은 색 순서로 보기 좋게 정렬합니다(조커는 빈 자리에). */
export function arrangeSet(tiles: Tile[]): Tile[] {
  const check = checkSet(tiles);
  if (!check.valid) return tiles;
  const withValue = tiles.map((t, i) => ({ t, v: check.values[i] }));
  if (check.kind === 'run') return withValue.sort((a, b) => a.v - b.v).map((x) => x.t);
  return sortTiles(tiles, 'color');
}

/** 남은 타일의 벌점(조커 30점). */
export function handPenalty(tiles: Tile[]): number {
  return tiles.reduce((sum, t) => sum + (t.joker ? JOKER_PENALTY : t.num), 0);
}

function idSet(tiles: Tile[]): string {
  return tiles
    .map((t) => t.id)
    .sort()
    .join(',');
}

export type TurnValidation = { ok: true; placedCount: number } | { ok: false; reason: string };

/**
 * 턴 종료 시 테이블 전체를 검증합니다.
 * - 모든 세트가 규칙에 맞아야 함
 * - 손에서 1장 이상 내려놓았어야 함(아니면 타일을 뽑아야 하므로 호출 전에 처리)
 * - 첫 등록 전이면: 내려놓은 타일만으로 만든 새 세트여야 하고(기존 세트 손대기 금지) 합계 30점 이상
 */
export function validateTurn(params: { before: Tile[][]; after: Tile[][]; handBefore: Tile[]; melded: boolean }): TurnValidation {
  const { before, after, handBefore, melded } = params;
  const handIds = new Set(handBefore.map((t) => t.id));
  const sets = after.filter((s) => s.length > 0);

  for (const set of sets) {
    const check = checkSet(set);
    if (!check.valid) return { ok: false, reason: check.reason };
  }

  const placed = sets.flat().filter((t) => handIds.has(t.id));
  if (placed.length === 0) return { ok: false, reason: '내려놓은 타일이 없어요. 타일을 뽑아야 해요.' };

  if (!melded) {
    const beforeKeys = new Set(before.map(idSet));
    let total = 0;
    for (const set of sets) {
      const mine = set.filter((t) => handIds.has(t.id)).length;
      if (mine === 0) {
        if (!beforeKeys.has(idSet(set))) return { ok: false, reason: '첫 등록 전에는 테이블의 세트를 바꿀 수 없어요.' };
        continue;
      }
      if (mine !== set.length) return { ok: false, reason: '첫 등록은 내 타일만으로 새 세트를 만들어야 해요.' };
      const check = checkSet(set);
      if (check.valid) total += check.value;
    }
    if (total < INITIAL_MELD) return { ok: false, reason: `첫 등록은 합계 ${INITIAL_MELD}점 이상이어야 해요. (지금 ${total}점)` };
  }

  return { ok: true, placedCount: placed.length };
}

// ---------- 컴퓨터 상대 ----------

type PlainTile = Extract<Tile, { joker: false }>;

/** 손패만으로 만들 수 있는 세트 후보(조커 포함)를 큰 것부터 고릅니다. */
function pickSetsFromHand(hand: Tile[]): Tile[][] {
  const result: Tile[][] = [];
  let remaining = [...hand];

  // 반복: 가장 긴 후보 하나를 고르고 그 타일을 빼고 다시 찾기
  for (;;) {
    const jokers = remaining.filter((t) => t.joker);
    const plain = remaining.filter((t): t is PlainTile => !t.joker);
    const candidates: Tile[][] = [];

    // 런 후보: 색별로 연속 구간(조커로 빈칸 1~2개까지 메움)
    for (const color of COLORS) {
      const byNum = new Map<number, PlainTile>();
      for (const t of plain) if (t.color === color && !byNum.has(t.num)) byNum.set(t.num, t);
      const nums = [...byNum.keys()].sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i += 1) {
        for (let j = i; j < nums.length; j += 1) {
          const span = nums[j] - nums[i] + 1;
          const have = j - i + 1;
          const gaps = span - have;
          if (gaps > jokers.length) break;
          if (span < 3) continue;
          const tiles: Tile[] = nums.slice(i, j + 1).map((n) => byNum.get(n)!);
          tiles.push(...jokers.slice(0, gaps));
          candidates.push(tiles);
        }
      }
    }

    // 그룹 후보: 숫자별로 서로 다른 색 3~4장(부족하면 조커 1장까지)
    for (let num = 1; num <= 13; num += 1) {
      const colors = new Map<TileColor, PlainTile>();
      for (const t of plain) if (t.num === num && !colors.has(t.color)) colors.set(t.color, t);
      const tiles: Tile[] = [...colors.values()];
      if (tiles.length >= 3) candidates.push(tiles);
      else if (tiles.length === 2 && jokers.length > 0) candidates.push([...tiles, jokers[0]]);
    }

    const setValue = (set: Tile[]) => {
      const c = checkSet(set);
      return c.valid ? c.value : 0;
    };
    const valid = candidates.filter((c) => checkSet(c).valid);
    if (valid.length === 0) break;
    valid.sort((a, b) => b.length - a.length || setValue(b) - setValue(a));
    const best = valid[0];
    result.push(best);
    const used = new Set(best.map((t) => t.id));
    remaining = remaining.filter((t) => !used.has(t.id));
  }
  return result;
}

export type CpuMove = { table: Tile[][]; placed: Tile[] };

/**
 * 컴퓨터의 한 턴. 테이블을 재배열하지는 않고(초보 수준), ① 손패로 새 세트 만들기
 * ② 등록을 마쳤으면 테이블 세트에 한 장씩 붙이기만 합니다. 낼 게 없으면 null(타일 뽑기).
 */
export function findCpuMove(hand: Tile[], table: Tile[][], melded: boolean): CpuMove | null {
  const newSets = pickSetsFromHand(hand);
  let placed: Tile[] = newSets.flat();
  const nextTable = [...table.map((s) => [...s]), ...newSets];

  if (!melded) {
    const total = newSets.reduce((sum, s) => {
      const c = checkSet(s);
      return sum + (c.valid ? c.value : 0);
    }, 0);
    if (total < INITIAL_MELD) return null;
    return { table: nextTable.map(arrangeSet), placed };
  }

  // 등록 후: 남은 손패를 기존 세트에 붙여보기
  const placedIds = new Set(placed.map((t) => t.id));
  let rest = hand.filter((t) => !placedIds.has(t.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const tile of rest) {
      for (let i = 0; i < nextTable.length; i += 1) {
        if (tile.joker && nextTable[i].some((t) => t.joker)) continue; // 조커를 한 세트에 몰아넣지 않음
        const candidate = [...nextTable[i], tile];
        if (checkSet(candidate).valid) {
          nextTable[i] = candidate;
          placed = [...placed, tile];
          rest = rest.filter((t) => t.id !== tile.id);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  if (placed.length === 0) return null;
  return { table: nextTable.map(arrangeSet), placed };
}
