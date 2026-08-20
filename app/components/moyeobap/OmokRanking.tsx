'use client';

import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';

type RankingEntry = {
  userId: string;
  userName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

export function OmokRanking() {
  const { data, error } = useSWR<{ ranking: RankingEntry[] }>('/api/games/omok/ranking', fetcher, {
    refreshInterval: 10000,
  });
  const ranking = data?.ranking ?? [];

  if (error) {
    return <p className="omok-ranking__error">랭킹을 불러오지 못했어요.</p>;
  }

  if (data && ranking.length === 0) {
    return <p className="omok-ranking__empty">아직 기록이 없어요. 첫 대국을 만들어보세요!</p>;
  }

  return (
    <table className="omok-ranking__table">
      <thead>
        <tr>
          <th>순위</th>
          <th>사용자</th>
          <th>Rating</th>
          <th>승</th>
          <th>패</th>
          <th>무</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((entry, index) => (
          <tr key={entry.userId}>
            <td>{index + 1}</td>
            <td className="omok-ranking__name">{entry.userName}</td>
            <td>{entry.rating}</td>
            <td>{entry.wins}</td>
            <td>{entry.losses}</td>
            <td>{entry.draws}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
