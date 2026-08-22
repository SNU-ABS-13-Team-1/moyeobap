'use client';

import { GameChat, type GameChatConfig } from './GameChat';

type OmokChatAuthorRole = 'black' | 'white' | 'spectator';

// 메시지를 쓴 시점의 역할입니다. 이 기능 이전에 쌓인 메시지는 역할이 없어서
// (null) 아무 표시도 붙지 않습니다.
const CONFIG: GameChatConfig<OmokChatAuthorRole> = {
  apiBase: '/api/games/omok/rooms',
  table: 'omok_chat_messages',
  channelPrefix: 'omok-chat',
  roleLabel: { black: '흑', white: '백', spectator: '관전' },
};

export function OmokChat({ roomId, myRole }: { roomId: string; myRole: OmokChatAuthorRole }) {
  return <GameChat config={CONFIG} myRole={myRole} roomId={roomId} />;
}
