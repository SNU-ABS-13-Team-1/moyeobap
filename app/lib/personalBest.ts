/**
 * 연습 모드의 내 최고 기록.
 *
 * 컴퓨터와 두는 판은 서버로 점수를 보내지 않습니다. 남이 볼 수 있으면
 * 연습이 아니라 시험이 되기 때문입니다. 대신 이 값만 브라우저에 남겨
 * "저번보다 잘했나"를 스스로 볼 수 있게 합니다.
 *
 * 이 값은 이 브라우저 밖으로 나가지 않습니다. 다른 기기에서 보면 없고,
 * 방문 기록을 지우면 같이 사라집니다. 그래도 되는 값만 여기 둡니다.
 */

const PREFIX = 'moyeobap:best:';

/** 브라우저가 저장을 막아 둔 경우(시크릿 창 등)에도 게임은 그대로 돌아가야 합니다. */
export function readPersonalBest(key: string): number | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** 새 기록이면 갱신합니다. 갱신 여부와 지금의 최고 기록을 함께 돌려줍니다. */
export function savePersonalBest(key: string, score: number): { best: number; isNew: boolean } {
  const previous = readPersonalBest(key);
  if (previous !== null && previous >= score) return { best: previous, isNew: false };
  try {
    localStorage.setItem(PREFIX + key, String(score));
  } catch {
    // 저장을 못 해도 이번 판 점수는 화면에 그대로 보여줍니다.
  }
  return { best: score, isNew: true };
}
