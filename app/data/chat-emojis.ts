export interface ChatEmoji {
  id: string;
  label: string;
  src: `/emojis/${string}.png`;
}

const CHAT_EMOJIS_V2: readonly ChatEmoji[] = [
  { id: 'hello', label: '안녕하세요!', src: '/emojis/hello.png' },
  { id: 'thank-you', label: '감사합니다!', src: '/emojis/thank-you.png' },
  { id: 'yes', label: '넵!', src: '/emojis/yes.png' },
  { id: 'like', label: '좋아요!', src: '/emojis/like.png' },
  { id: 'laugh', label: 'ㅋㅋㅋㅋ', src: '/emojis/laugh.png' },
  { id: 'sorry', label: '죄송해요ㅠ', src: '/emojis/sorry.png' },
  { id: 'good-job', label: '수고했어요!', src: '/emojis/good-job.png' },
  { id: 'wait', label: '잠시만요!!', src: '/emojis/wait.png' },
  { id: 'ill-order', label: '제가 주문할게요!', src: '/emojis/ill-order.png' },
  { id: 'coming-down', label: '지금 내려가요!!', src: '/emojis/coming-down.png' },
  { id: 'where-are-you', label: '어디세요??', src: '/emojis/where-are-you.png' },
  { id: 'cancel', label: '취소할게요ㅠ', src: '/emojis/cancel.png' },
  { id: 'pickleball', label: '피클볼 ㄱ?', src: '/emojis/pickleball.png' },
  { id: 'sleepy', label: '졸려', src: '/emojis/sleepy.png' },
  { id: 'hungry', label: '배고파...', src: '/emojis/hungry.png' },
  { id: 'exam-over', label: '시험 끝!', src: '/emojis/exam-over.png' },
];

const LEGACY_CHAT_EMOJIS: readonly ChatEmoji[] = [
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

// 피커 노출 순서 = 2차 개편분(16종) 먼저, 기존 12종이 뒤에 이어집니다.
// 전송 화이트리스트(getChatEmojiById)와 렌더용 조회(getChatEmojiBySrc)가
// 같은 목록을 보도록 하나로 유지합니다.
export const CHAT_EMOJIS: readonly ChatEmoji[] = [
  ...CHAT_EMOJIS_V2,
  ...LEGACY_CHAT_EMOJIS,
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
