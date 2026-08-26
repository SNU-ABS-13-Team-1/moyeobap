'use client';

import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { HallOfFame, type HallWeek } from './HallOfFame';
import { RankMedal, rankRowClass } from './RankMedal';
import { WeekNote, type WeekInfo } from './WeekNote';

type Entry = { userId: string; userName: string; games: number; wins: number; points: number };

// 루미큐브 온라인 랭킹: 누적 점수(승자 +상대 벌점 합, 패자 −내 벌점) 순.
export function RummyRanking() {
  const { data, error } = useSWR<{ ranking: Entry[]; hall?: HallWeek[]; week?: WeekInfo }>('/api/games/rummy/ranking', fetcher, { refreshInterval: 10000 });
  const ranking = data?.ranking ?? [];

  if (error) return <p className="omok-ranking__error">랭킹을 불러오지 못했어요.</p>;
  if (data && ranking.length === 0) {
    return (
      <>
        <WeekNote week={data.week} />
        <p className="omok-ranking__empty">이번 주 기록이 아직 없어요. 첫 판을 만들어보세요!</p>
        <HallOfFame hall={data.hall} unit="점" />
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
          <th>누적 점수</th>
          <th>승</th>
          <th>판수</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((e, i) => (
          <tr key={e.userId} className={rankRowClass(i + 1)}>
            <td><RankMedal rank={i + 1} /></td>
            <td className="omok-ranking__name">{e.userName}</td>
            <td>{e.points > 0 ? `+${e.points}` : e.points}</td>
            <td>{e.wins}</td>
            <td>{e.games}</td>
          </tr>
        ))}
      </tbody>
      </table>
      <HallOfFame hall={data?.hall} unit="점" />
    </>
  );
}
