'use client';

import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';

type AlkkagiLobbyRoom = LobbyRoomBase & {
  blackId: string | null;
  blackName: string | null;
  whiteId: string | null;
  whiteName: string | null;
};

// 알까기는 방장이 흑(아래쪽에서 시작하고 선공), 참여자가 백입니다.
const CONFIG: GameLobbyConfig<AlkkagiLobbyRoom> = {
  apiRooms: '/api/games/alkkagi/rooms',
  pagePath: '/games/alkkagi',
  rankingPath: '/games/alkkagi/ranking',
  namePlaceholder: '방 이름 (예: 점심 전 알까기)',
  hostId: (room) => room.blackId,
  hasOpenSeat: (room) => room.status === 'waiting' && (!room.blackId || !room.whiteId),
};

export function AlkkagiLobby() {
  return <GameLobby config={CONFIG} />;
}
