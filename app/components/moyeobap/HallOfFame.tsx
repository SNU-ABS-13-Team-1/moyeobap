'use client';

// 명예의 전당: 지난주까지의 주별 상위 3명. 랭킹은 매주 월요일(KST)에 새로 시작하고,
// 지나간 주의 1~3위만 여기 남습니다. 기록이 없던 주는 표시하지 않습니다.

export type HallEntry = { userId: string; userName: string; value: number };
export type HallWeek = { weekKey: string; label: string; entries: HallEntry[] };

const MEDALS = ['🥇', '🥈', '🥉'] as const;

export function HallOfFame({ hall, unit = '점' }: { hall: HallWeek[] | undefined; unit?: string }) {
  if (!hall || hall.length === 0) return null;
  return (
    <div className="hall">
      <p className="hall__title">🏛 명예의 전당</p>
      <ul className="hall__list">
        {hall.map((week) => (
          <li className="hall__week" key={week.weekKey}>
            <span className="hall__week-label">{week.label}</span>
            <span className="hall__winners">
              {week.entries.map((entry, i) => (
                <span className="hall__winner" key={entry.userId} title={`${entry.value.toLocaleString()}${unit}`}>
                  {MEDALS[i] ?? ''} {entry.userName}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
