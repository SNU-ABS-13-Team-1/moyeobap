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
  { id: 'exam-over', label: '시험 끝!', src: '/emojis/exam-over.png' },
];

// 3차 개편분(13종) — 미니게임 채팅에서 쓸 승부·감정 표현이 모자라서 추가했습니다.
const CHAT_EMOJIS_V3: readonly ChatEmoji[] = [
  { id: 'one-more-game', label: '한 판 더?', src: '/emojis/one-more-game.png' },
  { id: 'bring-it-on', label: '하면 함', src: '/emojis/bring-it-on.png' },
  { id: 'you-sure', label: '자신있어?', src: '/emojis/you-sure.png' },
  { id: 'swagger', label: '꺼드럭', src: '/emojis/swagger.png' },
  { id: 'teasing', label: 'ㅋㅋ', src: '/emojis/teasing.png' },
  { id: 'smile', label: '^^', src: '/emojis/smile.png' },
  { id: 'i-admit', label: '인정합니다', src: '/emojis/i-admit.png' },
  { id: 'no-way', label: '인정 못해!', src: '/emojis/no-way.png' },
  { id: 'frustrated', label: '분하다', src: '/emojis/frustrated.png' },
  { id: 'crying', label: 'ㅜㅜ', src: '/emojis/crying.png' },
  { id: 'hold-on', label: '기다려', src: '/emojis/hold-on.png' },
  { id: 'study-time', label: '공부할 시간이야', src: '/emojis/study-time.png' },
  { id: 'peekaboo', label: '우르르 까꿍', src: '/emojis/peekaboo.png' },
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

// 피커 노출 순서 = 2차 개편분(15종) → 3차 개편분(13종) → 기존 12종.
// 첫 줄에 인사·감사처럼 팟 채팅에서 제일 많이 쓰는 것이 오도록 2차분을 앞에
// 두고, 승부 표현이 모여 있는 3차분을 그 뒤에 붙입니다.
// 전송 화이트리스트(getChatEmojiById)와 렌더용 조회(getChatEmojiBySrc)가
// 같은 목록을 보도록 하나로 유지합니다.
export const CHAT_EMOJIS: readonly ChatEmoji[] = [
  ...CHAT_EMOJIS_V2,
  ...CHAT_EMOJIS_V3,
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
