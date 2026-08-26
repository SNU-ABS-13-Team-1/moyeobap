'use client';

import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';

type OmokLobbyRoom = LobbyRoomBase & {
  blackId: string | null;
  blackName: string | null;
  whiteId: string | null;
  whiteName: string | null;
};

// 오목은 방장이 흑, 참여자가 백입니다.
const CONFIG: GameLobbyConfig<OmokLobbyRoom> = {
  apiRooms: '/api/games/omok/rooms',
  pagePath: '/games/omok',
  rankingPath: '/games/omok/ranking',
  apiRanking: '/api/games/omok/ranking',
  namePlaceholder: '방 이름 (예: AI 연구실 오목)',
  hostId: (room) => room.blackId,
  hasOpenSeat: (room) => room.status === 'waiting' && (!room.blackId || !room.whiteId),
};

export function OmokLobby() {
  return <GameLobby config={CONFIG} />;
}
