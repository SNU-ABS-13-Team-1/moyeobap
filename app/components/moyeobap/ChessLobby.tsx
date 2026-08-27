'use client';

import { useState } from 'react';
import { TIME_CONTROL_LABEL, TIME_CONTROL_OPTIONS, type TimeControl } from '../../lib/chessMatch';
import { GameLobby, type GameLobbyConfig, type LobbyRoomBase } from './GameLobby';

type ChessLobbyRoom = LobbyRoomBase & {
  whiteId: string | null;
  whiteName: string | null;
  blackId: string | null;
  blackName: string | null;
  timeControl: TimeControl;
};

// 체스는 방장이 백(선수), 참여자가 흑입니다. 방을 만들 때 시간제를 고릅니다.
export function ChessLobby() {
  const [timeControl, setTimeControl] = useState<TimeControl>('move60');

  const config: GameLobbyConfig<ChessLobbyRoom> = {
    apiRooms: '/api/games/chess/rooms',
    pagePath: '/games/chess/online',
    rankingPath: '/games/chess/ranking',
    apiRanking: '/api/games/chess/ranking',
    namePlaceholder: '방 이름 (예: 점심 체스 한 판)',
    hostId: (room) => room.whiteId,
    hasOpenSeat: (room) => room.status === 'waiting' && (!room.whiteId || !room.blackId),
    roomMeta: (room) => TIME_CONTROL_LABEL[room.timeControl] ?? null,
    createBody: () => ({ timeControl }),
    createExtras: (
      <select
        aria-label="시간제"
        className="omok-lobby__select"
        onChange={(e) => setTimeControl(e.target.value as TimeControl)}
        value={timeControl}
      >
        {TIME_CONTROL_OPTIONS.map((option) => (
          <option key={option} value={option}>
            ⏱ {TIME_CONTROL_LABEL[option]}
          </option>
        ))}
      </select>
    ),
  };

  return <GameLobby config={config} />;
}
