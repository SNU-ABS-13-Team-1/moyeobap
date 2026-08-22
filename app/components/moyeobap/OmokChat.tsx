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
  // 오목 채팅만 모여밥 이모티콘을 씁니다. 체스는 chat 테이블에 kind 컬럼이
  // 없어서(20260827000000_omok_chat_emojis.sql은 omok만) 켜지 않습니다.
  emojis: true,
};

export function OmokChat({ roomId, myRole }: { roomId: string; myRole: OmokChatAuthorRole }) {
  return <GameChat config={CONFIG} myRole={myRole} roomId={roomId} />;
}
