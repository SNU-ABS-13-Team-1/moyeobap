'use client';

// 랭킹 1~3위는 숫자 대신 금·은·동 메달로 보여줍니다.
// 명예의 전당(HallOfFame)이 쓰는 메달과 같은 표기를 실시간 랭킹에도 맞췄습니다.

const MEDALS = ['🥇', '🥈', '🥉'] as const;
const MEDAL_LABEL = ['금메달', '은메달', '동메달'] as const;

export function medalOf(rank: number): string | undefined {
  return MEDALS[rank - 1];
}

// 1~3위 행에 붙일 클래스(표의 <tr>, 리스트의 <li> 공용). 4위부터는 빈 문자열.
export function rankRowClass(rank: number): string {
  return rank <= 3 ? `rank-row rank-row--${rank}` : '';
}

export function RankMedal({ rank, className }: { rank: number; className?: string }) {
  const medal = medalOf(rank);
  const classes = ['rank-medal', medal ? `rank-medal--medal rank-medal--${rank}` : '', className].filter(Boolean).join(' ');

  if (!medal) {
    return <span className={classes}>{rank}</span>;
  }

  return (
    <span className={classes} title={`${rank}위 · ${MEDAL_LABEL[rank - 1]}`} aria-label={`${rank}위`} role="img">
      {medal}
    </span>
  );
}
