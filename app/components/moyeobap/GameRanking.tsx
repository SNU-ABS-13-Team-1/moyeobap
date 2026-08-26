'use client';

import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { HallOfFame, type HallWeek } from './HallOfFame';
import { WeekNote, type WeekInfo } from './WeekNote';

// 실시간 대전 공용 ELO 랭킹 표. 오목·체스가 API 경로만 다르게 넘겨서 같이 씁니다.

export type RankingEntry = {
  userId: string;
  userName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

export function GameRanking({ apiRanking, children }: { apiRanking: string; children?: React.ReactNode }) {
  const { data, error } = useSWR<{ ranking: RankingEntry[]; hall?: HallWeek[]; week?: WeekInfo }>(apiRanking, fetcher, {
    refreshInterval: 30000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const ranking = data?.ranking ?? [];

  if (error) {
    return <p className="omok-ranking__error">랭킹을 불러오지 못했어요.</p>;
  }

  if (data && ranking.length === 0) {
    return (
      <>
        <WeekNote week={data.week} />
        <p className="omok-ranking__empty">이번 주 기록이 아직 없어요. 첫 대국을 만들어보세요!</p>
        <HallOfFame hall={data.hall} unit="점" />
        {children}
      </>
    );
  }

  return (
    <>
      <WeekNote week={data?.week} />
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
      <HallOfFame hall={data?.hall} unit="점" />
      {children}
    </>
  );
}
