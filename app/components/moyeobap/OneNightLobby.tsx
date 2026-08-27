'use client';

import { useState } from 'react';
import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';
import { OneNightRulebook } from './OneNightRulebook';
import { MAX_PLAYERS, MIN_PLAYERS, TIME_PRESETS } from '../../lib/onenightMatch';

type OneNightLobbyRoom = LobbyRoomBase & {
  hostId: string | null;
  players: { id: string; name: string; left: boolean }[];
  settings: { nightSec: number; daySec: number; voteSec: number };
};

// 원나잇 인랑 로비. 대기 중인 방에만 들어갈 수 있습니다(시작된 판은 다음 판부터).
export function OneNightLobby() {
  const [preset, setPreset] = useState(TIME_PRESETS[0].key);

  const config: GameLobbyConfig<OneNightLobbyRoom> = {
    apiRooms: '/api/games/onenight/rooms',
    pagePath: '/games/onenight',
    namePlaceholder: '방 이름 (예: 점심 인랑)',
    maxPlayers: MAX_PLAYERS,
    hostId: (room) => room.hostId,
    playerCount: (room) => room.players.filter((p) => !p.left).length,
    hasOpenSeat: (room) => room.status === 'waiting' && room.players.filter((p) => !p.left).length < MAX_PLAYERS,
    isMember: (room, userId) => room.players.some((p) => p.id === userId && !p.left),
    roomMeta: (room) => `밤 ${room.settings.nightSec}초 · 토론 ${Math.round(room.settings.daySec / 60)}분`,
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

  return (
    <>
      <div className="onenight-lobby__intro">
        <div>
          <h2>밤 한 번, 낮 한 번. 그걸로 끝.</h2>
          <p>
            {MIN_PLAYERS}~{MAX_PLAYERS}명이 카드를 한 장씩 받고, 밤 사이 누군가 카드를 바꿔 놓아요.
            한 명을 지목하면 판이 끝나요 — 죽어도 구경만 하는 시간이 없어요.
          </p>
        </div>
        <OneNightRulebook />
      </div>
      <GameLobby config={config} />
    </>
  );
}
