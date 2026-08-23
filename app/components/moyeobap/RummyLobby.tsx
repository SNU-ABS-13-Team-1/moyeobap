'use client';

import { useState } from 'react';
import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';

type RummyLobbyRoom = LobbyRoomBase & {
  hostId: string;
  players: { id: string; name: string; left: boolean }[];
  turnLimitSec: number;
};

const TURN_LIMITS = [60, 90, 120, 180] as const;

// 루미큐브 온라인 로비. 최대 4명, 대기 중인 방에만 참여할 수 있고 시작된 방은 관전합니다.
export function RummyLobby() {
  const [turnLimit, setTurnLimit] = useState<number>(90);

  const config: GameLobbyConfig<RummyLobbyRoom> = {
    apiRooms: '/api/games/rummy/rooms',
    pagePath: '/games/rummy/online',
    rankingPath: '/games/rummy/ranking',
    namePlaceholder: '방 이름 (예: 점심 루미큐브)',
    maxPlayers: 4,
    hostId: (room) => room.hostId,
    playerCount: (room) => room.players.filter((p) => !p.left).length,
    hasOpenSeat: (room) => room.status === 'waiting' && room.players.length < 4,
    isMember: (room, userId) => room.players.some((p) => p.id === userId && !p.left),
    roomMeta: (room) => `턴당 ${room.turnLimitSec}초`,
    createBody: () => ({ turnLimitSec: turnLimit }),
    createExtras: (
      <select aria-label="턴 제한 시간" className="omok-lobby__select" onChange={(e) => setTurnLimit(Number(e.target.value))} value={turnLimit}>
        {TURN_LIMITS.map((sec) => (
          <option key={sec} value={sec}>
            ⏱ 턴당 {sec}초
          </option>
        ))}
      </select>
    ),
  };

  return <GameLobby config={config} />;
}
