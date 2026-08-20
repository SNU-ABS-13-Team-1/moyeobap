'use client';

import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';

type RankingEntry = {
  userId: string;
  userName: string;
  rating: number;
  wins: number;
  losses: number;
};

export function PongRanking() {
  const { data, error } = useSWR<{ ranking: RankingEntry[] }>('/api/games/pong/ranking', fetcher, {
    refreshInterval: 10000,
  });
  const ranking = data?.ranking ?? [];

  if (error) {
    return <p className="pong-ranking__error">랭킹을 불러오지 못했어요.</p>;
  }

  if (data && ranking.length === 0) {
    return <p className="pong-ranking__empty">아직 기록이 없어요. 첫 대전을 만들어보세요!</p>;
  }

  return (
    <table className="pong-ranking__table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Rating</th>
          <th>W</th>
          <th>L</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((entry, index) => (
          <tr key={entry.userId}>
            <td>{index + 1}</td>
            <td className="pong-ranking__name">{entry.userName}</td>
            <td>{entry.rating}</td>
            <td>{entry.wins}</td>
            <td>{entry.losses}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
