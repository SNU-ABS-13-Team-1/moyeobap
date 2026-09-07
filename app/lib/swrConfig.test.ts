import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSmartGameRoomPollingInterval } from './swrConfig.ts';

describe('getSmartGameRoomPollingInterval', () => {
  it('게임 진행 중(playing) 내 턴일 때는 트래픽 절감을 위해 0초(폴링 정지)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: 'playing',
      isMyTurn: true,
      isSpectator: false,
    });
    assert.equal(interval, 0);
  });

  it('게임 진행 중(playing) 상대방 턴일 때는 웹소켓 지연/누락 방지를 위해 3.5초(3500ms)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: 'playing',
      isMyTurn: false,
      isSpectator: false,
    });
    assert.equal(interval, 3500);
  });

  it('게임 진행 중(playing) 관전자일 때는 5초(5000ms)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: 'playing',
      isMyTurn: false,
      isSpectator: true,
    });
    assert.equal(interval, 5000);
  });

  it('바둑 계가 중(scoring) 상대방 턴일 때 3.5초(3500ms)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: 'scoring',
      isMyTurn: false,
      isSpectator: false,
    });
    assert.equal(interval, 3500);
  });

  it('대기 중(waiting)에는 상대 입장 감지를 위해 6초(6000ms)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: 'waiting',
      isMyTurn: false,
      isSpectator: false,
    });
    assert.equal(interval, 6000);
  });

  it('대국 종료(finished) 시에는 재대국 신청 감지를 위해 8초(8000ms)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: 'finished',
      isMyTurn: false,
      isSpectator: false,
    });
    assert.equal(interval, 8000);
  });

  it('방 상태가 없거나 초기 로드일 때는 10초(10000ms)를 반환한다', () => {
    const interval = getSmartGameRoomPollingInterval({
      status: undefined,
      isMyTurn: false,
      isSpectator: false,
    });
    assert.equal(interval, 10000);
  });
});
