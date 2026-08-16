export function getTimeRemaining(deadline: Date, now = Date.now()) {
  const total = deadline.getTime() - now;
  const minutes = Math.max(0, Math.floor(total / 60000));
  const seconds = Math.max(0, Math.floor((total / 1000) % 60));
  return {
    total,
    minutes,
    seconds,
    isUrgent: total > 0 && total <= 5 * 60000,
    isExpired: total <= 0
  };
}

export function formatTime(m: number, s: number): string {
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 개별 메뉴 선택은 없어서 실제 주문 총액은 알 수 없습니다. 대신 대표메뉴 1개당
 * 1인분이라고 가정하고 최소주문금액을 채우는 데 필요한 인원을 추정치로 보여줍니다.
 */
export function estimateNeededParticipants(minOrder: number, firstMenuPrice: string | undefined): number | null {
  if (minOrder <= 0 || !firstMenuPrice) return null;
  const price = Number(firstMenuPrice.replace(/[^0-9]/g, ''));
  if (!price) return null;
  return Math.max(1, Math.ceil(minOrder / price));
}

export interface DateGroupedPots<T extends { deadline: Date }> {
  dateLabel: string;
  pots: T[];
}

export function groupPotsByDate<T extends { deadline: Date }>(
  pots: T[],
  now = Date.now(),
): DateGroupedPots<T>[] {
  const nowDate = new Date(now);
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const groups = new Map<string, { label: string; orderKey: number; pots: T[] }>();

  for (const pot of pots) {
    const potDate = new Date(pot.deadline);
    const dayStart = new Date(potDate.getFullYear(), potDate.getMonth(), potDate.getDate()).getTime();

    let label: string;
    if (dayStart === todayStart) {
      label = '📅 오늘 마감된 팟';
    } else if (dayStart === yesterdayStart) {
      label = '🗓️ 어제 마감된 팟';
    } else {
      label = `📁 ${potDate.getMonth() + 1}월 ${potDate.getDate()}일 마감된 팟`;
    }

    if (!groups.has(label)) {
      groups.set(label, { label, orderKey: dayStart, pots: [] });
    }
    groups.get(label)!.pots.push(pot);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.orderKey - a.orderKey)
    .map((g) => ({ dateLabel: g.label, pots: g.pots }));
}
