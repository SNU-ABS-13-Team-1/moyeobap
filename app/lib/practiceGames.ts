/**
 * 연습 모드(컴퓨터 대결)의 게임 이름.
 *
 * 이 게임들은 랭킹을 두지 않습니다. 남이 볼 수 있으면 연습이 아니라
 * 시험이 되어서, 눈치 보지 않고 편하게 하시라고 뺐습니다.
 *
 * 화면에서 안 보여주는 것만으로는 부족합니다. 주소를 직접 치면 예전 기록이
 * 그대로 나오기 때문에, 서버에서도 이 게임들의 점수 API를 닫습니다.
 */
const PRACTICE_PREFIXES = ["chess-l", "rummy-l"];

export function isPracticeGame(game: string): boolean {
  return PRACTICE_PREFIXES.some((prefix) => game.startsWith(prefix));
}
