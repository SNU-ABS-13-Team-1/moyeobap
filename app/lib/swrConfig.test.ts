import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_ROOM_RECOVERY_DELAYS, POLLING_PRESETS } from './swrConfig.ts';

test('게임·팟·채팅은 팀의 비상 폴링 주기를 사용한다', () => {
  assert.equal(POLLING_PRESETS.GAME_ROOM.refreshInterval, 20000);
  assert.equal(POLLING_PRESETS.POT_DETAIL.refreshInterval, 25000);
  assert.equal(POLLING_PRESETS.CHAT_FALLBACK.refreshInterval, 30000);
});

test('모든 프리셋은 숨겨진 탭에서 폴링을 중단한다', () => {
  for (const preset of Object.values(POLLING_PRESETS)) assert.equal(preset.refreshWhenHidden, false);
});

test('장애 재연결은 횟수를 제한하고 점점 간격을 늘린다', () => {
  assert.equal(GAME_ROOM_RECOVERY_DELAYS.length, 3);
  assert.ok(GAME_ROOM_RECOVERY_DELAYS.every((delay, index, values) => index === 0 || delay > values[index - 1]));
});
