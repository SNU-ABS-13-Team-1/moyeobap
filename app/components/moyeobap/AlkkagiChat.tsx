'use client';

import { GameChat, type GameChatConfig } from './GameChat';

type AlkkagiChatAuthorRole = 'black' | 'white' | 'spectator';

// 메시지를 쓴 시점의 역할입니다. 재대국으로 흑백이 바뀌어도 지난 메시지의
// 표시는 그대로 남습니다(서버가 쓸 때 함께 저장합니다).
const CONFIG: GameChatConfig<AlkkagiChatAuthorRole> = {
  apiBase: '/api/games/alkkagi/rooms',
  table: 'alkkagi_chat_messages',
  channelPrefix: 'alkkagi-chat',
  roleLabel: { black: '흑', white: '백', spectator: '관전' },
  // 채팅 테이블에 kind 컬럼을 처음부터 넣었으므로 이모티콘을 바로 켭니다.
  emojis: true,
};

export function AlkkagiChat({ roomId, myRole }: { roomId: string; myRole: AlkkagiChatAuthorRole }) {
  return <GameChat config={CONFIG} myRole={myRole} roomId={roomId} />;
}
