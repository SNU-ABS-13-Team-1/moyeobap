'use client';

import { useState } from 'react';
import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';
import { MAX_PLAYERS, TIME_PRESETS } from '../../lib/phoneMatch';

type PhoneLobbyRoom = LobbyRoomBase & {
  hostId: string;
  players: { id: string; name: string; left: boolean }[];
  settings: { writeSec: number; drawSec: number };
};

// 갈틱폰 로비. 최대 10명, 대기 중인 방에만 들어갈 수 있습니다(시작된 방은 다음 판부터).
export function PhoneLobby() {
  const [preset, setPreset] = useState(TIME_PRESETS[0].key);

  const config: GameLobbyConfig<PhoneLobbyRoom> = {
    apiRooms: '/api/games/phone/rooms',
    pagePath: '/games/phone',
    namePlaceholder: '방 이름 (예: 점심 갈틱폰)',
    maxPlayers: MAX_PLAYERS,
    hostId: (room) => room.hostId,
    playerCount: (room) => room.players.filter((p) => !p.left).length,
    hasOpenSeat: (room) => room.status === 'waiting' && room.players.length < MAX_PLAYERS,
    isMember: (room, userId) => room.players.some((p) => p.id === userId && !p.left),
    roomMeta: (room) => `글 ${room.settings.writeSec}초 · 그림 ${room.settings.drawSec}초`,
    createBody: () => TIME_PRESETS.find((p) => p.key === preset)?.settings ?? TIME_PRESETS[0].settings,
    createExtras: (
      <select aria-label="제한 시간" className="omok-lobby__select" onChange={(e) => setPreset(e.target.value)} value={preset}>
        {TIME_PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            ⏱ {p.label}
          </option>
        ))}
      </select>
    ),
  };

  return <GameLobby config={config} />;
}
