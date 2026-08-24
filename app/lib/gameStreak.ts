// 연속 우승 계산. 명예의 전당(game_week_hall)에 남은 주별 1위만 보고 셉니다.
//
// 두 가지를 지킵니다.
// 1. 주가 정확히 7일 간격으로 이어질 때만 "연속"입니다. 아무도 랭킹을 열지 않아
//    스냅샷이 통째로 빠진 주가 있으면 거기서 끊습니다(빈 주를 건너뛰고 이으면
//    실제로는 우승하지 않은 주까지 연속으로 세게 됩니다).
// 2. 진행 중인 이번 주는 명예의 전당에 없으므로 애초에 세지 않습니다.
//    따라서 "3주 연속"은 잠정이 아니라 이미 끝난 주로 확정된 기록입니다.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 명예의 전당 한 주. 1위는 entries[0]입니다(HallWeek이 그대로 들어맞습니다). */
export type StreakWeek = { weekKey: string; entries: { userId: string }[] };

/** 연속 우승 한 구간. atLeast는 조회 창(최근 N주) 밖으로 더 이어질 수 있다는 뜻입니다. */
export type Streak = { weeks: number; atLeast: boolean };

function weekKeyMs(weekKey: string): number {
  const [y, m, d] = weekKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * 주별 연속 우승 뱃지. hall과 같은 길이의 배열을 돌려주고, 연속이 끝나는 가장 최근
 * 주에만 값이 들어갑니다(같은 연속을 주마다 반복해서 붙이지 않기 위해서입니다).
 * hall은 최신 주부터 정렬돼 있어야 합니다.
 */
export function winStreaks(hall: StreakWeek[]): (Streak | null)[] {
  const badges: (Streak | null)[] = hall.map(() => null);

  let i = 0;
  while (i < hall.length) {
    const champion = hall[i].entries[0];
    if (!champion) {
      i += 1;
      continue;
    }

    let end = i; // 이 연속 구간의 가장 오래된 주
    while (
      end + 1 < hall.length &&
      weekKeyMs(hall[end].weekKey) - weekKeyMs(hall[end + 1].weekKey) === WEEK_MS &&
      hall[end + 1].entries[0]?.userId === champion.userId
    ) {
      end += 1;
    }

    const weeks = end - i + 1;
    if (weeks >= 2) {
      badges[i] = { weeks, atLeast: end === hall.length - 1 };
    }
    i = end + 1;
  }

  return badges;
}

/** 화면 표기용: "3주 연속" / 조회 창 끝까지 이어지면 "8주+ 연속". */
export function streakLabel(streak: Streak): string {
  return `${streak.weeks}주${streak.atLeast ? "+" : ""} 연속`;
}
