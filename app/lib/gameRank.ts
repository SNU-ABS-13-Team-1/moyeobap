/**
 * 순위 매기기(공용 순수 모듈).
 *
 * 점수가 같으면 순위도 같아야 합니다. 목록의 몇 번째인지로 순위를 세면
 * 같은 점수인데 한 명은 2위, 한 명은 3위가 됩니다.
 *
 * 스포츠 중계와 같은 방식(공동 순위 뒤는 건너뜁니다):
 *   100점, 100점, 90점, 80점  →  1위, 1위, 3위, 4위
 * 공동 1위가 둘이면 은메달 없이 바로 동메달로 넘어가는 것도 이 규칙 그대로입니다.
 *
 * 들어오는 목록은 이미 정렬돼 있어야 합니다.
 */
export function assignRanks<T>(sorted: readonly T[], valueOf: (item: T) => number): (T & { rank: number })[] {
  let rank = 0;
  let previous: number | null = null;

  return sorted.map((item, index) => {
    const value = valueOf(item);
    // 앞사람과 값이 같으면 순위를 그대로 물려받고, 다르면 여태 센 인원수 + 1.
    if (previous === null || value !== previous) rank = index + 1;
    previous = value;
    return { ...item, rank };
  });
}
