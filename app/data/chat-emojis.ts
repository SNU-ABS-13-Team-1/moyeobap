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

// 피커는 쓰는 자리에 맞춰 나눠 보여줍니다. 40종을 한 격자에 다 깔면 원하는
// 걸 찾기 어렵고, "입금완료!"를 체스 방에서, "꺼드럭"을 정산 대화에서 볼
// 이유도 없기 때문입니다.

/** 게임방 피커에도 함께 둘 공용 이모티콘. 인사·감사는 어디서나 씁니다. */
const SHARED_WITH_GAME = new Set(['hello', 'thank-you', 'good-job', 'wait']);

/** 팟 채팅 피커: 주문·정산 맥락. 2차 개편분(15종) 먼저, 기존 12종이 뒤에. */
export const POT_CHAT_EMOJIS: readonly ChatEmoji[] = [
  ...CHAT_EMOJIS_V2,
  ...LEGACY_CHAT_EMOJIS,
];

/** 게임방 피커: 승부 표현 13종 먼저, 공용 몇 개가 뒤에. */
export const GAME_CHAT_EMOJIS: readonly ChatEmoji[] = [
  ...CHAT_EMOJIS_V3,
  ...CHAT_EMOJIS_V2.filter((emoji) => SHARED_WITH_GAME.has(emoji.id)),
];

// 전송 화이트리스트이자 렌더용 조회 대상입니다. 피커가 나뉘어도 이쪽은 40종을
// 전부 알아야 합니다 — 게임방에서 온 메시지를 나중에 어디서 보든, 또 피커
// 구성을 바꾼 뒤에도 지난 메시지가 깨지지 않아야 하기 때문입니다.
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
