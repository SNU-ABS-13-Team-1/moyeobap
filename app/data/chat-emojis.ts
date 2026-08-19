export interface ChatEmoji {
  id: string;
  label: string;
  src: `/emojis/${string}.png`;
}

export const CHAT_EMOJIS: readonly ChatEmoji[] = [
  { id: 'volunteer', label: '저요!', src: '/emojis/volunteer.png' },
  { id: 'plus-one', label: '+1', src: '/emojis/plus-one.png' },
  { id: 'lets-go', label: 'ㄱㄱ!', src: '/emojis/lets-go.png' },
  { id: 'menu-question', label: '메뉴 뭐임?', src: '/emojis/menu-question.png' },
  { id: 'same-order', label: '나도 그거!', src: '/emojis/same-order.png' },
  { id: 'price-question', label: '얼마예요?', src: '/emojis/price-question.png' },
  { id: 'payment-complete', label: '입금완료!', src: '/emojis/payment-complete.png' },
  { id: 'order-complete', label: '주문완료!', src: '/emojis/order-complete.png' },
  { id: 'deadline-soon', label: '마감임박!', src: '/emojis/deadline-soon.png' },
  { id: 'closed', label: '마감!', src: '/emojis/closed.png' },
  { id: 'arrived', label: '도착!!', src: '/emojis/arrived.png' },
  { id: 'thanks-for-meal', label: '잘먹겠습니다', src: '/emojis/thanks-for-meal.png' },
];

export function getChatEmojiById(id: unknown): ChatEmoji | undefined {
  if (typeof id !== 'string') return undefined;
  return CHAT_EMOJIS.find((emoji) => emoji.id === id);
}

export function getChatEmojiBySrc(src: unknown): ChatEmoji | undefined {
  if (typeof src !== 'string') return undefined;
  return CHAT_EMOJIS.find((emoji) => emoji.src === src);
}

export function isChatEmojiPath(src: unknown): src is `/emojis/${string}` {
  return typeof src === 'string' && src.startsWith('/emojis/');
}
