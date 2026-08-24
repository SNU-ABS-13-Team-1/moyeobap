'use client';

import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';

type BadukLobbyRoom = LobbyRoomBase & {
  blackId: string;
  blackName: string;
  whiteId: string | null;
  whiteName: string | null;
};

// 바둑은 방장이 흑(선수), 참여자가 백(덤을 받음)입니다.
const CONFIG: GameLobbyConfig<BadukLobbyRoom> = {
  apiRooms: '/api/games/baduk/rooms',
  pagePath: '/games/baduk',
  rankingPath: '/games/baduk/ranking',
  namePlaceholder: '방 이름 (예: 점심 내기 바둑)',
  hostId: (room) => room.blackId,
  hasOpenSeat: (room) => room.status === 'waiting' && !room.whiteId,
};

export function BadukLobby() {
  return <GameLobby config={CONFIG} />;
}
