import { COLORS, INITIAL_MELD, arrangeSet, checkSet, handPenalty, type Tile, type TileColor } from './rummy';

/**
 * 루미큐브 컴퓨터 상대 — 5단계.
 *
 *  1 완전 초보: 손패만으로 새 세트를 만들고, 가끔(30%) 낼 수 있는데도 그냥 타일을 뽑습니다.
 *  2 초보:     손패 세트 + 테이블 세트 끝에 한 장씩 붙이기.
 *  3 중수:     + 런을 쪼개서 끼워 넣기, 4장짜리 그룹·긴 런에서 한 장 빼와서 내 타일과 새 세트 만들기.
 *  4 고수:     + 조커 회수(같은 타일로 바꿔치기 후 그 턴에 사용). 두 단계 앞까지 조합을 탐색해 가장 많이 내는 수를 고릅니다.
 *  5 프로:     네 단계 앞까지 탐색(빔 탐색). 같은 장수면 남는 벌점이 적은 쪽을 고릅니다.
 *
 * 모든 단계에서 첫 등록은 손패만으로 30점 이상일 때만 합니다(규칙).
 */
export type RummyDifficulty = 1 | 2 | 3 | 4 | 5;

export const RUMMY_DIFFICULTY_LABEL: Record<RummyDifficulty, string> = {
  1: '완전 초보',
  2: '초보',
  3: '중수',
  4: '고수',
  5: '프로',
};

export type CpuMove = { table: Tile[][]; placed: Tile[] };

type PlainTile = Extract<Tile, { joker: false }>;
type State = { hand: Tile[]; table: Tile[][] };
type Op = 'new' | 'append' | 'split' | 'borrow' | 'joker';

const LEVEL_OPS: Record<RummyDifficulty, Op[]> = {
  1: ['new'],
  2: ['new', 'append'],
  3: ['new', 'append', 'split', 'borrow'],
  4: ['new', 'append', 'split', 'borrow', 'joker'],
  5: ['new', 'append', 'split', 'borrow', 'joker'],
};
const LEVEL_DEPTH: Record<RummyDifficulty, number> = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 5 };
const LEVEL_BEAM: Record<RummyDifficulty, number> = { 1: 1, 2: 4, 3: 8, 4: 16, 5: 28 };
const NODE_LIMIT = 4000;

function isPlain(t: Tile): t is PlainTile {
  return !t.joker;
}

function without(tiles: Tile[], ids: Set<string>): Tile[] {
  return tiles.filter((t) => !ids.has(t.id));
}

function idsOf(tiles: Tile[]): Set<string> {
  return new Set(tiles.map((t) => t.id));
}

// ---------- 손패만으로 만들 수 있는 세트 후보 ----------

/** 손패에서 만들 수 있는 모든 세트(3장 이상, 조커 포함). 큰 것이 먼저 옵니다. */
function handSetCandidates(hand: Tile[]): Tile[][] {
  const jokers = hand.filter((t) => t.joker);
  const plain = hand.filter(isPlain);
  const out: Tile[][] = [];

  for (const color of COLORS) {
    const byNum = new Map<number, PlainTile>();
    for (const t of plain) if (t.color === color && !byNum.has(t.num)) byNum.set(t.num, t);
    const nums = [...byNum.keys()].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i += 1) {
      for (let j = i; j < nums.length; j += 1) {
        const span = nums[j] - nums[i] + 1;
        const gaps = span - (j - i + 1);
        if (gaps > jokers.length) break;
        const base: Tile[] = nums.slice(i, j + 1).map((n) => byNum.get(n)!);
        const withGapJokers = [...base, ...jokers.slice(0, gaps)];
        if (withGapJokers.length >= 3 && checkSet(withGapJokers).valid) out.push(withGapJokers);
        // 남는 조커를 끝에 덧붙인 더 긴 런
        for (let extra = 1; gaps + extra <= jokers.length; extra += 1) {
          const longer = [...base, ...jokers.slice(0, gaps + extra)];
          if (longer.length >= 3 && checkSet(longer).valid) out.push(longer);
        }
      }
    }
  }

  for (let num = 1; num <= 13; num += 1) {
    const byColor = new Map<TileColor, PlainTile>();
    for (const t of plain) if (t.num === num && !byColor.has(t.color)) byColor.set(t.color, t);
    const tiles = [...byColor.values()];
    if (tiles.length >= 3) {
      out.push(tiles);
      if (tiles.length === 4) {
        // 4장 중 3장만 내는 선택지도 둡니다(나머지 한 장을 다른 곳에 쓸 수 있음)
        for (let skip = 0; skip < 4; skip += 1) out.push(tiles.filter((_, i) => i !== skip));
      }
    }
    for (let j = 1; j <= jokers.length && tiles.length + j <= 4 && tiles.length + j >= 3; j += 1) {
      if (tiles.length >= 1) out.push([...tiles, ...jokers.slice(0, j)]);
    }
  }

  return out.sort((a, b) => b.length - a.length);
}

/** 손패 후보 중 겹치지 않게 골라 합계 점수가 가장 큰 조합(첫 등록용). */
function bestDisjointSets(hand: Tile[]): { sets: Tile[][]; total: number } {
  const candidates = handSetCandidates(hand).filter((c) => checkSet(c).valid);
  let best: { sets: Tile[][]; total: number } = { sets: [], total: 0 };
  let nodes = 0;
  const visit = (start: number, used: Set<string>, chosen: Tile[][], total: number) => {
    nodes += 1;
    if (total > best.total) best = { sets: [...chosen], total };
    if (nodes > 1500) return;
    for (let i = start; i < candidates.length; i += 1) {
      const c = candidates[i];
      if (c.some((t) => used.has(t.id))) continue;
      const next = new Set(used);
      c.forEach((t) => next.add(t.id));
      const check = checkSet(c);
      visit(i + 1, next, [...chosen, c], total + (check.valid ? check.value : 0));
    }
  };
  visit(0, new Set(), [], 0);
  return best;
}

// ---------- 한 단계 조작(op) 생성 ----------

type Child = { state: State; placed: number };

function addSet(table: Tile[][], set: Tile[]): Tile[][] {
  return [...table, arrangeSet(set)];
}

function generateChildren(state: State, ops: Op[]): Child[] {
  const children: Child[] = [];
  const { hand, table } = state;

  if (ops.includes('new')) {
    for (const set of handSetCandidates(hand)) {
      children.push({ state: { hand: without(hand, idsOf(set)), table: addSet(table, set) }, placed: set.length });
    }
  }

  if (ops.includes('append')) {
    for (const tile of hand) {
      for (let i = 0; i < table.length; i += 1) {
        if (tile.joker && table[i].some((t) => t.joker)) continue;
        const candidate = [...table[i], tile];
        if (!checkSet(candidate).valid) continue;
        const nextTable = table.map((s, j) => (j === i ? arrangeSet(candidate) : s));
        children.push({ state: { hand: without(hand, idsOf([tile])), table: nextTable }, placed: 1 });
      }
    }
  }

  if (ops.includes('split')) {
    // 런 5-6-7-8-9에 내 7을 끼워 [5,6,7] [7,8,9]로 쪼개기(조커 없는 런만)
    for (let i = 0; i < table.length; i += 1) {
      const set = table[i];
      const check = checkSet(set);
      if (!check.valid || check.kind !== 'run' || set.length < 5 || set.some((t) => t.joker)) continue;
      const run = arrangeSet(set).filter(isPlain);
      for (const tile of hand.filter(isPlain)) {
        if (tile.color !== run[0].color) continue;
        const idx = run.findIndex((t) => t.num === tile.num);
        if (idx < 2 || run.length - idx < 3) continue;
        const left = run.slice(0, idx + 1);
        const right = [tile, ...run.slice(idx + 1)];
        const nextTable = table.filter((_, j) => j !== i);
        children.push({ state: { hand: without(hand, idsOf([tile])), table: [...nextTable, left, right] }, placed: 1 });
      }
    }
  }

  if (ops.includes('borrow')) {
    // 세트에서 한 장을 빼와(남는 세트가 유효할 때) 내 타일 2장 이상과 새 세트 만들기
    for (let i = 0; i < table.length; i += 1) {
      const set = table[i];
      for (const taken of set) {
        if (taken.joker) continue;
        const rest = set.filter((t) => t.id !== taken.id);
        if (rest.length < 3 || !checkSet(rest).valid) continue;
        for (const combo of combosWith(taken, hand)) {
          const nextTable = table.map((s, j) => (j === i ? rest : s));
          children.push({ state: { hand: without(hand, idsOf(combo)), table: addSet(nextTable, [taken, ...combo]) }, placed: combo.length });
        }
      }
    }
  }

  if (ops.includes('joker')) {
    // 테이블의 조커를 같은 값의 내 타일로 바꿔치기 → 회수한 조커는 내 타일 2장과 새 세트로 즉시 사용
    for (let i = 0; i < table.length; i += 1) {
      const set = table[i];
      const check = checkSet(set);
      if (!check.valid) continue;
      const jokerIdx = set.findIndex((t) => t.joker);
      if (jokerIdx < 0) continue;
      const joker = set[jokerIdx];
      const value = check.values[jokerIdx];
      const plainInSet = set.filter(isPlain);
      const replacements = hand.filter(isPlain).filter((t) => {
        if (t.num !== value) return false;
        if (check.kind === 'run') return t.color === plainInSet[0].color;
        return !plainInSet.some((p) => p.color === t.color);
      });
      for (const rep of replacements) {
        const replacedSet = set.map((t) => (t.id === joker.id ? rep : t));
        if (!checkSet(replacedSet).valid) continue;
        const handAfter = without(hand, idsOf([rep]));
        for (const combo of combosWith(joker, handAfter)) {
          const nextTable = table.map((s, j) => (j === i ? arrangeSet(replacedSet) : s));
          children.push({
            state: { hand: without(handAfter, idsOf(combo)), table: addSet(nextTable, [joker, ...combo]) },
            placed: combo.length + 1,
          });
        }
      }
    }
  }

  return children;
}

/** `anchor` 타일과 함께 유효한 세트가 되는 손패 2~3장 조합. */
function combosWith(anchor: Tile, hand: Tile[]): Tile[][] {
  const out: Tile[][] = [];
  const pool = hand.slice(0, 24);
  for (let a = 0; a < pool.length; a += 1) {
    for (let b = a + 1; b < pool.length; b += 1) {
      const two = [pool[a], pool[b]];
      if (checkSet([anchor, ...two]).valid) out.push(two);
      for (let c = b + 1; c < pool.length; c += 1) {
        const three = [pool[a], pool[b], pool[c]];
        if (checkSet([anchor, ...three]).valid) out.push(three);
      }
    }
  }
  return out;
}

// ---------- 탐색 ----------

function scoreState(placed: number, hand: Tile[]): number {
  return placed * 1000 - handPenalty(hand);
}

function search(start: State, ops: Op[], depth: number, beam: number): { state: State; placed: number } {
  let frontier: Child[] = [{ state: start, placed: 0 }];
  let best: Child = frontier[0];
  let nodes = 0;

  for (let d = 0; d < depth && frontier.length > 0; d += 1) {
    const next: Child[] = [];
    const seen = new Set<string>();
    for (const node of frontier) {
      for (const child of generateChildren(node.state, ops)) {
        nodes += 1;
        const key = child.state.hand
          .map((t) => t.id)
          .sort()
          .join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const total = { state: child.state, placed: node.placed + child.placed };
        next.push(total);
        if (scoreState(total.placed, total.state.hand) > scoreState(best.placed, best.state.hand)) best = total;
        if (nodes > NODE_LIMIT) break;
      }
      if (nodes > NODE_LIMIT) break;
    }
    next.sort((a, b) => scoreState(b.placed, b.state.hand) - scoreState(a.placed, a.state.hand));
    frontier = next.slice(0, beam);
    if (nodes > NODE_LIMIT) break;
  }
  return best;
}

export function findCpuMoveByLevel(hand: Tile[], table: Tile[][], melded: boolean, level: RummyDifficulty): CpuMove | null {
  // 첫 등록: 손패만으로 30점 이상 조합이 있을 때만. (완전 초보는 그냥 제일 먼저 찾은 조합)
  if (!melded) {
    const best = bestDisjointSets(hand);
    if (best.total < INITIAL_MELD) return null;
    if (level === 1 && Math.random() < 0.3) return null;
    const placed = best.sets.flat();
    return { table: [...table, ...best.sets.map(arrangeSet)], placed };
  }

  if (level === 1 && Math.random() < 0.3) return null;

  const result = search({ hand, table }, LEVEL_OPS[level], LEVEL_DEPTH[level], LEVEL_BEAM[level]);
  if (result.placed === 0) return null;

  const afterIds = idsOf(result.state.hand);
  const placed = hand.filter((t) => !afterIds.has(t.id));
  return { table: result.state.table.map(arrangeSet), placed };
}
