import test from "node:test";
import assert from "node:assert/strict";
import { isPracticeGame } from "./practiceGames.ts";

test("컴퓨터 대결은 연습 모드다", () => {
  for (const game of ["chess-l1", "chess-l5", "rummy-l1", "rummy-l5"]) {
    assert.equal(isPracticeGame(game), true, game);
  }
});

test("점수 랭킹이 있는 게임은 연습 모드가 아니다", () => {
  for (const game of ["flappy", "snake"]) {
    assert.equal(isPracticeGame(game), false, game);
  }
});

test("사람끼리 겨루는 게임 이름과 헷갈리지 않는다", () => {
  // 실시간 대전은 레이팅을 따로 쓰지만, 혹시 점수 API로 와도 막히면 안 됩니다.
  for (const game of ["chess", "rummy", "omok", "pong", "baduk"]) {
    assert.equal(isPracticeGame(game), false, game);
  }
});
