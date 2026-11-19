'use client';

import { useState } from 'react';
import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';

type QuoridorLobbyRoom = LobbyRoomBase & {
  hostId: string;
  mode: 2 | 4;
  anonymous?: boolean;
  players: { id: string; name: string; left: boolean }[];
  turnLimitSec: number;
};

const TURN_LIMITS = [30, 60, 90, 120] as const;

// 쿼리도 로비. 방마다 2인전·4인전을 고르고, 대기 중인 방에만 참여할 수 있습니다(시작된 방은 관전).
export function QuoridorLobby() {
  const [mode, setMode] = useState<2 | 4>(2);
  const [turnLimit, setTurnLimit] = useState<number>(60);
  const [anonymous, setAnonymous] = useState(false);

  const config: GameLobbyConfig<QuoridorLobbyRoom> = {
    apiRooms: '/api/games/quoridor/rooms',
    pagePath: '/games/quoridor',
    rankingPath: '/games/quoridor/ranking',
    apiRanking: '/api/games/quoridor/ranking',
    namePlaceholder: '방 이름 (예: 점심 쿼리도)',
    maxPlayers: (room) => room.mode,
    allowSpectateWaiting: true,
    hostId: (room) => room.hostId,
    playerCount: (room) => room.players.filter((p) => !p.left).length,
    hasOpenSeat: (room) => room.status === 'waiting' && room.players.filter((p) => !p.left).length < room.mode,
    isMember: (room, userId) => room.players.some((p) => p.id === userId && !p.left),
    roomMeta: (room) => `${room.mode}인전 · 턴당 ${room.turnLimitSec}초${room.anonymous ? ' · 🎭 익명' : ''}`,
    // select 값은 createBody로만 요청에 실립니다.
    createBody: () => ({ mode, turnLimitSec: turnLimit, anonymous }),
    createExtras: (
      <>
        <select aria-label="인원" className="omok-lobby__select" onChange={(e) => setMode(Number(e.target.value) === 4 ? 4 : 2)} value={mode}>
          <option value={2}>👥 2인전</option>
          <option value={4}>👥 4인전</option>
        </select>
        <select aria-label="턴 제한 시간" className="omok-lobby__select" onChange={(e) => setTurnLimit(Number(e.target.value))} value={turnLimit}>
          {TURN_LIMITS.map((sec) => (
            <option key={sec} value={sec}>
              ⏱ 턴당 {sec}초
            </option>
          ))}
        </select>
        <label className="quoridor-lobby__toggle" title="게임 중에는 이름 대신 색(빨강·파랑·노랑·초록)으로만 보여요. 끝나면 공개돼요.">
          <input checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} type="checkbox" />
          🎭 익명(색깔만)
        </label>
      </>
    ),
  };

  return <GameLobby config={config} />;
}
