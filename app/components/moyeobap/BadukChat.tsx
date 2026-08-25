'use client';

import { GameChat, type GameChatConfig } from './GameChat';

type BadukChatAuthorRole = 'black' | 'white' | 'spectator';

const CONFIG: GameChatConfig<BadukChatAuthorRole> = {
  apiBase: '/api/games/baduk/rooms',
  table: 'baduk_chat_messages',
  channelPrefix: 'baduk-chat',
  emojis: true,
  roleLabel: { black: '흑', white: '백', spectator: '관전' },
};

export function BadukChat({ roomId, myRole }: { roomId: string; myRole: BadukChatAuthorRole }) {
  return <GameChat config={CONFIG} myRole={myRole} roomId={roomId} />;
}
