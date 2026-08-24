'use client';

// 랭킹이 어느 주 기록인지 알려주는 한 줄 안내. 랭킹은 매주 월요일 0시(KST)에 새로 시작하고,
// 지나간 주의 상위 3명은 명예의 전당(HallOfFame)에 남습니다.

export type WeekInfo = { key: string; label: string };

export function WeekNote({ week }: { week: WeekInfo | undefined }) {
  if (!week) return null;
  return <p className="week-note">📅 {week.label} — 랭킹은 매주 월요일에 새로 시작해요</p>;
}
