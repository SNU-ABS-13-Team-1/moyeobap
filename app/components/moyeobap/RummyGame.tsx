'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { HallOfFame, type HallWeek } from './HallOfFame';
import { WeekNote, type WeekInfo } from './WeekNote';
import { requestJson } from '../../lib/api-client';
import { HAND_SIZE, INITIAL_MELD, arrangeSet, createDeck, handPenalty, sortTiles, validateTurn, type Tile } from '../../lib/rummy';
import { RUMMY_DIFFICULTY_LABEL, findCpuMoveByLevel, type RummyDifficulty } from '../../lib/rummyAi';
import { useAuth } from './AuthProvider';
import { RummyBoard, applyMove, type MoveTarget, type Selection } from './RummyBoard';

// 루미큐브 — 컴퓨터 상대(1~3명, 난이도 5단계). 난이도별로 랭킹이 따로 있습니다.

const CPU_THINK_MS = 900;
const CPU_NAMES = ['컴퓨터 A', '컴퓨터 B', '컴퓨터 C'];
const DIFFICULTIES: RummyDifficulty[] = [1, 2, 3, 4, 5];

type ScoreEntry = { userId: string; userName: string; bestScore: number };
type LeaderboardResponse = { leaderboard: ScoreEntry[]; myRank: number | null; week?: WeekInfo; hall?: HallWeek[] };

type Player = { name: string; isCpu: boolean; hand: Tile[]; melded: boolean };
type Game = {
  players: Player[];
  deck: Tile[];
  table: Tile[][];
  current: number;
  winner: number | null;
  /** 타일 더미가 빈 뒤 연속으로 넘긴 횟수. 모두가 넘기면 벌점이 가장 적은 사람이 이깁니다. */
  passStreak: number;
  /** 더미가 빈 뒤 모두 넘겨서 끝났는지(벌점 최소 승리). */
  stuck: boolean;
  /** 사람 턴 시작 시점의 테이블·손패(되돌리기·검증용). */
  snapshot: { table: Tile[][]; hand: Tile[] };
};

function leaderboardUrl(level: RummyDifficulty): string {
  return `/api/games/rummy-l${level}/scores`;
}

function newGame(cpuCount: number): Game {
  let deck = createDeck();
  const players: Player[] = [{ name: '나', isCpu: false, hand: [], melded: false }];
  for (let i = 0; i < cpuCount; i += 1) players.push({ name: CPU_NAMES[i], isCpu: true, hand: [], melded: false });
  for (const p of players) {
    p.hand = sortTiles(deck.slice(0, HAND_SIZE), 'color');
    deck = deck.slice(HAND_SIZE);
  }
  // 공식 규칙은 가장 높은 타일을 뽑은 사람이 선 — 여기서는 무작위로 정합니다.
  const first = Math.floor(Math.random() * players.length);
  return {
    players,
    deck,
    table: [],
    current: first,
    winner: null,
    passStreak: 0,
    stuck: false,
    snapshot: { table: [], hand: players[0].hand },
  };
}

function advance(g: Game): Game {
  const next = (g.current + 1) % g.players.length;
  return { ...g, current: next, snapshot: next === 0 ? { table: g.table, hand: g.players[0].hand } : g.snapshot };
}

function drawTile(g: Game, playerIndex: number): { game: Game; drew: boolean } {
  if (g.deck.length === 0) return { game: g, drew: false };
  const [tile, ...deck] = g.deck;
  const players = g.players.map((p, i) => (i === playerIndex ? { ...p, hand: sortTiles([...p.hand, tile], 'color') } : p));
  return { game: { ...g, deck, players }, drew: true };
}

/** 더미가 비었는데 모두 넘기면 종료: 벌점이 가장 적은 사람이 승리. */
function finishIfStuck(g: Game): Game {
  if (g.deck.length > 0 || g.passStreak < g.players.length) return g;
  const penalties = g.players.map((p) => handPenalty(p.hand));
  const winner = penalties.indexOf(Math.min(...penalties));
  return { ...g, winner, stuck: true };
}

export function RummyGame() {
  const { currentUser } = useAuth();
  const [cpuCount, setCpuCount] = useState(1);
  const [level, setLevel] = useState<RummyDifficulty>(3);
  const [game, setGame] = useState<Game>(() => newGame(1));
  const [selection, setSelection] = useState<Selection[]>([]);
  const [sortBy, setSortBy] = useState<'color' | 'num'>('color');
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR<LeaderboardResponse>(leaderboardUrl(level), fetcher);

  const me = game.players[0];
  const isMyTurn = game.current === 0 && game.winner === null;
  const placedThisTurn = useMemo(() => {
    const before = new Set(game.snapshot.hand.map((t) => t.id));
    return game.table.flat().filter((t) => before.has(t.id)).length;
  }, [game.snapshot.hand, game.table]);

  function startNewGame(count = cpuCount, nextLevel = level) {
    setCpuCount(count);
    setLevel(nextLevel);
    setGame(newGame(count));
    setSelection([]);
    setMessage(null);
    setSubmitted(false);
    setSavedScore(null);
  }

  function toggleSelect(id: string, from: 'hand' | number) {
    if (!isMyTurn) return;
    setSelection((prev) => (prev.some((s) => s.id === id) ? prev.filter((s) => s.id !== id) : [...prev, { id, from }]));
  }

  const placedIds = useMemo(() => new Set(game.snapshot.hand.map((t) => t.id)), [game.snapshot.hand]);
  const canDropToHand = selection.length > 0 && selection.every((s) => s.from === 'hand' || placedIds.has(s.id));

  function moveSelected(target: MoveTarget) {
    if (!isMyTurn || selection.length === 0) return;
    if (target === 'hand' && !canDropToHand) {
      setMessage('원래 테이블에 있던 타일은 손으로 가져올 수 없어요.');
      return;
    }
    const next = applyMove({ hand: me.hand, table: game.table, selection, target });
    setGame({ ...game, players: game.players.map((p, i) => (i === 0 ? { ...p, hand: next.hand } : p)), table: next.table });
    setSelection([]);
    setMessage(null);
  }

  function resetTurn() {
    if (!isMyTurn) return;
    setGame({ ...game, table: game.snapshot.table, players: game.players.map((p, i) => (i === 0 ? { ...p, hand: game.snapshot.hand } : p)) });
    setSelection([]);
    setMessage(null);
  }

  function submitScore(g: Game) {
    if (!currentUser || submitted) return;
    const score = g.players.slice(1).reduce((sum, p) => sum + handPenalty(p.hand), 0);
    setSubmitted(true);
    requestJson(leaderboardUrl(level), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) })
      .then(() => {
        setSavedScore(score);
        mutateLeaderboard();
      })
      .catch(() => null);
  }

  function endTurn() {
    if (!isMyTurn) return;
    const result = validateTurn({ before: game.snapshot.table, after: game.table, handBefore: game.snapshot.hand, melded: me.melded });
    if (!result.ok) {
      if (placedThisTurn === 0) {
        // 낸 게 없으면(테이블만 만졌더라도 원상복구하고) 타일을 뽑고 턴을 넘깁니다.
        const { game: g, drew } = drawTile({ ...game, table: game.snapshot.table }, 0);
        const withStreak = { ...g, passStreak: drew ? 0 : g.passStreak + 1 };
        const next = finishIfStuck(advance(withStreak));
        setGame(next);
        setSelection([]);
        setMessage(null);
        if (next.winner === 0) submitScore(next);
        return;
      }
      setMessage(result.reason);
      return;
    }

    const players = game.players.map((p, i) => (i === 0 ? { ...p, melded: true } : p));
    const table = game.table.map(arrangeSet);
    const won = players[0].hand.length === 0;
    const g: Game = { ...game, players, table, passStreak: 0, winner: won ? 0 : null };
    setGame(won ? g : advance(g));
    setSelection([]);
    setMessage(null);
    if (won) submitScore(g);
  }

  // 컴퓨터 턴: 잠깐 생각한 뒤 한 턴을 둡니다(연속 컴퓨터 턴은 current가 바뀔 때마다 다시 실행).
  const currentIndex = game.current;
  const currentIsCpu = game.winner === null && game.players[currentIndex].isCpu;
  useEffect(() => {
    if (!currentIsCpu) return undefined;
    const timer = window.setTimeout(() => {
      setGame((g) => {
        if (g.winner !== null || !g.players[g.current].isCpu) return g;
        const player = g.players[g.current];
        const move = findCpuMoveByLevel(player.hand, g.table, player.melded, level);
        if (!move) {
          const { game: drawn, drew } = drawTile(g, g.current);
          const withStreak = { ...drawn, passStreak: drew ? 0 : drawn.passStreak + 1 };
          return finishIfStuck(advance(withStreak));
        }
        const placedIds = new Set(move.placed.map((t) => t.id));
        const players = g.players.map((p, i) => (i === g.current ? { ...p, hand: p.hand.filter((t) => !placedIds.has(t.id)), melded: true } : p));
        const won = players[g.current].hand.length === 0;
        const next: Game = { ...g, players, table: move.table, passStreak: 0 };
        if (won) return { ...next, winner: g.current };
        return advance(next);
      });
    }, CPU_THINK_MS);
    return () => window.clearTimeout(timer);
  }, [currentIsCpu, currentIndex, level]);

  const statusText = (() => {
    if (game.winner === 0) return game.stuck ? '🎉 더 낼 사람이 없어 벌점이 가장 적은 내가 이겼어요!' : '🎉 이겼어요!';
    if (game.winner !== null) return game.stuck ? `더 낼 사람이 없어 벌점이 가장 적은 ${game.players[game.winner].name}이(가) 이겼어요.` : `${game.players[game.winner].name}이(가) 이겼어요.`;
    if (isMyTurn) return me.melded ? '내 차례 — 타일을 내거나 뽑으세요.' : `내 차례 — 첫 등록(${INITIAL_MELD}점 이상)을 해보세요.`;
    return `${game.players[game.current].name}(${RUMMY_DIFFICULTY_LABEL[level]}) 차례…`;
  })();

  return (
    <div className="rummy">
      <div className="rummy__toolbar">
        <span className="rummy__toolbar-label">난이도</span>
        {DIFFICULTIES.map((n) => (
          <button className={`rummy__chip ${level === n ? 'rummy__chip--active' : ''}`} key={n} onClick={() => startNewGame(cpuCount, n)} type="button">
            {RUMMY_DIFFICULTY_LABEL[n]}
          </button>
        ))}
      </div>
      <div className="rummy__toolbar">
        <span className="rummy__toolbar-label">상대 수</span>
        {[1, 2, 3].map((n) => (
          <button className={`rummy__chip ${cpuCount === n ? 'rummy__chip--active' : ''}`} key={n} onClick={() => startNewGame(n)} type="button">
            컴퓨터 {n}명
          </button>
        ))}
        <button className="rummy__btn rummy__btn--ghost" onClick={() => startNewGame()} type="button">
          새 게임
        </button>
      </div>

      <div className="rummy__players">
        {game.players.map((p, i) => (
          <span
            className={`rummy__player ${game.current === i && game.winner === null ? 'rummy__player--active' : ''} ${game.winner === i ? 'rummy__player--winner' : ''}`}
            key={p.name}
          >
            {p.isCpu ? '🤖' : '🙂'} {p.name} · {p.hand.length}장{p.melded ? '' : ' · 미등록'}
          </span>
        ))}
        <span className="rummy__deck">🂠 남은 타일 {game.deck.length}</span>
      </div>

      <p className={`rummy__status ${game.winner !== null ? 'rummy__status--over' : ''}`} aria-live="polite">
        {statusText}
      </p>

      <RummyBoard
        active={isMyTurn}
        canDropToHand={canDropToHand}
        hand={me.hand}
        onMove={moveSelected}
        onSortBy={setSortBy}
        onToggleSelect={toggleSelect}
        selection={selection}
        sortBy={sortBy}
        table={game.table}
      />

      {message && <p className="rummy__message">{message}</p>}

      <div className="rummy__actions">
        <button className="rummy__btn" disabled={!isMyTurn} onClick={endTurn} type="button">
          {placedThisTurn > 0 ? '턴 종료' : game.deck.length > 0 ? '타일 뽑고 넘기기' : '넘기기'}
        </button>
        <button className="rummy__btn rummy__btn--ghost" disabled={!isMyTurn} onClick={resetTurn} type="button">
          이번 턴 되돌리기
        </button>
        <button className="rummy__btn rummy__btn--ghost" disabled={selection.length === 0} onClick={() => setSelection([])} type="button">
          선택 해제
        </button>
      </div>

      {savedScore !== null && (
        <p className="rummy__saved">
          {RUMMY_DIFFICULTY_LABEL[level]} 랭킹에 {savedScore}점이 기록됐어요. (상대들의 남은 타일 벌점 합)
        </p>
      )}

      <div className="rummy__leaderboard">
        <p className="rummy__leaderboard-title">🏆 {RUMMY_DIFFICULTY_LABEL[level]} 이번 주 랭킹 (최고 점수)</p>
        <WeekNote week={leaderboardData?.week} />
        {!currentUser && <p className="rummy__leaderboard-note">로그인하면 이겼을 때 점수가 랭킹에 기록돼요.</p>}
        {leaderboardData && leaderboardData.leaderboard.length === 0 && <p className="rummy__leaderboard-note">아직 기록이 없어요. 이 난이도의 첫 승리를 남겨보세요!</p>}
        {leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <ol className="rummy__leaderboard-list">
            {leaderboardData.leaderboard.map((entry, index) => (
              <li className={`rummy__leaderboard-item ${currentUser?.id === entry.userId ? 'rummy__leaderboard-item--me' : ''}`} key={entry.userId}>
                <span className="rummy__leaderboard-rank">{index + 1}</span>
                <span className="rummy__leaderboard-name">{entry.userName}</span>
                <span className="rummy__leaderboard-score">{entry.bestScore}</span>
              </li>
            ))}
          </ol>
        )}
        <HallOfFame hall={leaderboardData?.hall} unit="점" />
      </div>
    </div>
  );
}
