'use client';

import { GameChat, type GameChatConfig } from './GameChat';

type ChessChatAuthorRole = 'white' | 'black' | 'spectator';

const CONFIG: GameChatConfig<ChessChatAuthorRole> = {
  apiBase: '/api/games/chess/rooms',
  table: 'chess_chat_messages',
  channelPrefix: 'chess-chat',
  roleLabel: { white: '백', black: '흑', spectator: '관전' },
};

export function ChessChat({ roomId, myRole }: { roomId: string; myRole: ChessChatAuthorRole }) {
  return <GameChat config={CONFIG} myRole={myRole} roomId={roomId} />;
}
