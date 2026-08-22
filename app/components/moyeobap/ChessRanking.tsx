'use client';

import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { END_REASON_LABEL, type ChessEndReason } from '../../lib/chessMatch';
import { GameRanking } from './GameRanking';

type RecentMatch = {
  id: string;
  whiteName: string;
  blackName: string;
  winner: 'white' | 'black' | 'draw';
  endReason: string | null;
  moveCount: number;
  endedAt: string;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function reasonLabel(reason: string | null): string {
  if (!reason) return '';
  return END_REASON_LABEL[reason as NonNullable<ChessEndReason>] ?? reason;
}

// ELO 표(공용) 아래에 체스만의 "최근 대국" 목록을 덧붙입니다.
export function ChessRanking() {
  const { data } = useSWR<{ recent: RecentMatch[] }>('/api/games/chess/ranking', fetcher, { refreshInterval: 10000 });
  const recent = data?.recent ?? [];

  return (
    <GameRanking apiRanking="/api/games/chess/ranking">
      {recent.length > 0 && (
        <section className="chess-recent">
          <h3 className="chess-recent__title">최근 대국</h3>
          <ul className="chess-recent__list">
            {recent.map((m) => {
              const result = m.winner === 'draw' ? '무승부' : m.winner === 'white' ? `♔ ${m.whiteName} 승` : `♚ ${m.blackName} 승`;
              return (
                <li className="chess-recent__item" key={m.id}>
                  <span className="chess-recent__players">
                    ♔ {m.whiteName} vs ♚ {m.blackName}
                  </span>
                  <span className="chess-recent__result">
                    {result}
                    {m.endReason ? ` · ${reasonLabel(m.endReason)}` : ''} · {m.moveCount}수
                  </span>
                  <span className="chess-recent__when">{formatWhen(m.endedAt)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </GameRanking>
  );
}
