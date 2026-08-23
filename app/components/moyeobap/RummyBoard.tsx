'use client';

import { useMemo } from 'react';
import { COLOR_LABEL, checkSet, handPenalty, sortTiles, type Tile } from '../../lib/rummy';

// 루미큐브 테이블·손패 화면(공용). 컴퓨터전(RummyGame)과 온라인 대전(RummyRoom)이 같이 씁니다.
// 타일을 누르면 선택, 세트의 + / 새 세트 / 손으로 보내기를 눌러 옮깁니다.

export type Selection = { id: string; from: 'hand' | number };
export type MoveTarget = number | 'new' | 'hand';

export function TileView({ tile, selected, onClick }: { tile: Tile; selected?: boolean; onClick?: () => void }) {
  const label = tile.joker ? '★' : String(tile.num);
  const cls = ['rummy-tile', tile.joker ? 'rummy-tile--joker' : `rummy-tile--${tile.color}`, selected ? 'rummy-tile--selected' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      aria-label={tile.joker ? '조커' : `${COLOR_LABEL[tile.color]} ${tile.num}`}
      aria-pressed={selected}
      className={cls}
      disabled={!onClick}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

type RummyBoardProps = {
  table: Tile[][];
  hand: Tile[];
  /** 내가 조작할 수 있는 상태인지(내 차례). */
  active: boolean;
  selection: Selection[];
  onToggleSelect: (id: string, from: 'hand' | number) => void;
  onMove: (target: MoveTarget) => void;
  /** 선택한 타일을 손으로 되돌릴 수 있는지(이번 턴에 낸 타일만 가능). */
  canDropToHand: boolean;
  sortBy: 'color' | 'num';
  onSortBy: (by: 'color' | 'num') => void;
  handTitle?: string;
};

export function RummyBoard({ table, hand, active, selection, onToggleSelect, onMove, canDropToHand, sortBy, onSortBy, handTitle }: RummyBoardProps) {
  const selectedIds = useMemo(() => new Set(selection.map((s) => s.id)), [selection]);
  const sortedHand = useMemo(() => sortTiles(hand, sortBy), [hand, sortBy]);

  return (
    <>
      <section className="rummy__table" aria-label="테이블">
        {table.length === 0 && <p className="rummy__empty">아직 테이블에 세트가 없어요.</p>}
        {table.map((set, i) => {
          const check = checkSet(set);
          return (
            <div className={`rummy__set ${check.valid ? '' : 'rummy__set--invalid'}`} key={set.map((t) => t.id).join('|')}>
              {set.map((tile) => (
                <TileView key={tile.id} onClick={active ? () => onToggleSelect(tile.id, i) : undefined} selected={selectedIds.has(tile.id)} tile={tile} />
              ))}
              {active && selection.length > 0 && (
                <button aria-label="이 세트에 놓기" className="rummy__drop" onClick={() => onMove(i)} type="button">
                  +
                </button>
              )}
              <span className="rummy__set-info">{check.valid ? `${check.value}점` : check.reason}</span>
            </div>
          );
        })}
        {active && selection.length > 0 && (
          <button className="rummy__drop rummy__drop--new" onClick={() => onMove('new')} type="button">
            + 새 세트로 놓기 ({selection.length}장)
          </button>
        )}
      </section>

      <section className="rummy__hand-area" aria-label="내 손패">
        <div className="rummy__hand-toolbar">
          <span className="rummy__toolbar-label">
            {handTitle ?? '내 타일'} {hand.length}장 · 벌점 {handPenalty(hand)}
          </span>
          <button className={`rummy__chip ${sortBy === 'color' ? 'rummy__chip--active' : ''}`} onClick={() => onSortBy('color')} type="button">
            색깔순
          </button>
          <button className={`rummy__chip ${sortBy === 'num' ? 'rummy__chip--active' : ''}`} onClick={() => onSortBy('num')} type="button">
            숫자순
          </button>
          {active && selection.length > 0 && (
            <button className="rummy__chip" disabled={!canDropToHand} onClick={() => onMove('hand')} type="button">
              선택 타일 손으로
            </button>
          )}
        </div>
        <div className="rummy__hand">
          {sortedHand.map((tile) => (
            <TileView key={tile.id} onClick={active ? () => onToggleSelect(tile.id, 'hand') : undefined} selected={selectedIds.has(tile.id)} tile={tile} />
          ))}
          {sortedHand.length === 0 && <span className="rummy__empty">타일이 없어요</span>}
        </div>
      </section>
    </>
  );
}

/** 선택한 타일들을 손/테이블 사이에서 옮긴 결과. 규칙 검증은 하지 않습니다(턴 종료 때 검증). */
export function applyMove(params: {
  hand: Tile[];
  table: Tile[][];
  selection: Selection[];
  target: MoveTarget;
}): { hand: Tile[]; table: Tile[][] } {
  const { hand, table, selection, target } = params;
  const ids = new Set(selection.map((s) => s.id));
  const moving: Tile[] = [];
  const nextHand = hand.filter((t) => {
    if (ids.has(t.id)) {
      moving.push(t);
      return false;
    }
    return true;
  });
  let nextTable = table.map((set) =>
    set.filter((t) => {
      if (ids.has(t.id)) {
        moving.push(t);
        return false;
      }
      return true;
    }),
  );

  if (target === 'hand') {
    return { hand: [...nextHand, ...moving], table: nextTable.filter((s) => s.length > 0) };
  }
  if (target === 'new') nextTable = [...nextTable, moving];
  else nextTable = nextTable.map((set, i) => (i === target ? [...set, ...moving] : set));
  return { hand: nextHand, table: nextTable.filter((s) => s.length > 0) };
}
