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

// 사용자 피드백으로 보강한 게임 진행·응원 표현 6종.
const CHAT_EMOJIS_V4: readonly ChatEmoji[] = [
  { id: 'interesting', label: '흥미롭군요…', src: '/emojis/interesting.png' },
  { id: 'fighting', label: '화이팅!', src: '/emojis/fighting.png' },
  { id: 'nice', label: '나이스!', src: '/emojis/nice.png' },
  { id: 'ok', label: 'ㅇㅋ', src: '/emojis/ok.png' },
  { id: 'dozing', label: 'zzz…', src: '/emojis/dozing.png' },
  { id: 'speed-game', label: '스겜', src: '/emojis/speed-game.png' },
];

// 공동주문 조율에 바로 쓸 수 있는 시간·자리·정산 표현 6종.
const CHAT_EMOJIS_V5_POT: readonly ChatEmoji[] = [
  { id: 'meet-time', label: '몇 시에?', src: '/emojis/kimplog-meet-time.png' },
  { id: 'seat-ready', label: '자리 잡음!', src: '/emojis/kimplog-seat-ready.png' },
  { id: 'receipt', label: '영수증이요!', src: '/emojis/kimplog-receipt.png' },
  { id: 'split-bill', label: 'N빵 가자!', src: '/emojis/kimprat-split-bill.png' },
  { id: 'spicy-check', label: '맵기 괜찮?', src: '/emojis/kimplog-spicy-check.png' },
  { id: 'still-waiting', label: '아직 멀었어?', src: '/emojis/kimprat-still-waiting.png' },
];

// 미니게임 진행·관전·승부에 쓰는 표현 7종.
const CHAT_EMOJIS_V5_GAME: readonly ChatEmoji[] = [
  { id: 'rules-help', label: '룰 알려줘', src: '/emojis/kimplog-rules-help.png' },
  { id: 'lagging', label: '렉이다 렉!', src: '/emojis/kimprat-lagging.png' },
  { id: 'watching', label: '관전 중!', src: '/emojis/kimplog-watching.png' },
  { id: 'next-time', label: '다음엔 이길거야…', src: '/emojis/kimprat-next-time.png' },
  { id: 'bet', label: '내기 ㄱ?', src: '/emojis/kimprat-bet.png' },
  { id: 'surrender', label: '기권!', src: '/emojis/kimplog-surrender.png' },
  { id: 'champion', label: '내가 짱!', src: '/emojis/kimplog-champion.png' },
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

// 전송 화이트리스트이자 렌더용 조회 대상입니다. 피커가 나뉘어도 이쪽은 59종을
// 전부 알아야 합니다 — 게임방에서 온 메시지를 나중에 어디서 보든, 또 피커
// 구성을 바꾼 뒤에도 지난 메시지가 깨지지 않아야 하기 때문입니다.
export const CHAT_EMOJIS: readonly ChatEmoji[] = [
  ...CHAT_EMOJIS_V2,
  ...CHAT_EMOJIS_V3,
  ...CHAT_EMOJIS_V4,
  ...CHAT_EMOJIS_V5_POT,
  ...CHAT_EMOJIS_V5_GAME,
  ...LEGACY_CHAT_EMOJIS,
];

const BY_ID = new Map(CHAT_EMOJIS.map((emoji) => [emoji.id, emoji]));

/** 순서 목록의 id를 실제 이모티콘으로 바꿉니다. 오타는 즉시 터뜨립니다. */
function pickInOrder(ids: readonly string[]): readonly ChatEmoji[] {
  return ids.map((id) => {
    const emoji = BY_ID.get(id);
    if (!emoji) throw new Error(`피커 순서에 없는 이모티콘 id: ${id}`);
    return emoji;
  });
}

// 피커는 쓰는 자리에 맞춰 나눠 보여줍니다. 59종을 한 격자에 다 깔면 원하는
// 걸 찾기 어렵고, "입금완료!"를 체스 방에서, "꺼드럭"을 정산 대화에서 볼
// 이유도 없기 때문입니다.
//
// 피커 안에서는 캐릭터 테마로 한 번 더 나눕니다(사용자 피드백). 흰 밥공기
// (모여밥)와 개구리·쥐(김프랫·김프로그)는 그림체가 달라 섞여 있으면 산만하고,
// 묶어 두면 "김프로그 것 중에서 고르기"가 됩니다. 각 테마 안의 순서는
// "추가한 순서"가 아니라 "쓰는 순서"입니다. 격자 높이가 220px로 묶여 있어
// (입력줄이 밀려나지 않게) 스크롤 없이 보이는 건 PC 7~10개, 폰(3열) 5~6개
// 뿐이라 앞 두 줄에 무엇을 두느냐가 사실상 전부입니다. 아래 목록은 네 개씩
// 한 줄로 읽으면 됩니다.

export interface ChatEmojiSection {
  title: string;
  emojis: readonly ChatEmoji[];
}

/** 팟 채팅 피커: 모여밥(참여→위치→주문·정산→마감→인사) / 김프랫·김프로그(약속→기다림→정산). */
export const POT_CHAT_EMOJI_SECTIONS: readonly ChatEmojiSection[] = [
  {
    title: '모여밥',
    emojis: pickInOrder([
      'volunteer', 'plus-one', 'yes', 'like',
      'where-are-you', 'coming-down', 'ill-order', 'menu-question',
      'same-order', 'price-question', 'payment-complete', 'order-complete',
      'deadline-soon', 'closed', 'arrived', 'lets-go',
      'wait', 'cancel', 'hello', 'thank-you',
      'good-job', 'thanks-for-meal', 'laugh', 'sorry',
      'pickleball', 'sleepy', 'exam-over',
    ]),
  },
  {
    title: '김프랫·김프로그',
    emojis: pickInOrder([
      'meet-time', 'seat-ready', 'still-waiting', 'spicy-check',
      'split-bill', 'receipt',
    ]),
  },
];

/**
 * 게임방 피커: 모여밥(맞장구→도전→반응→감정→자리비움) / 김프랫·김프로그(진행→승부).
 *
 * '기다려(hold-on)'는 사용자 피드백으로 피커에서 뺐습니다. 화이트리스트에는
 * 남아 있어 이미 보낸 메시지는 계속 그려집니다.
 */
export const GAME_CHAT_EMOJI_SECTIONS: readonly ChatEmojiSection[] = [
  {
    title: '모여밥',
    emojis: pickInOrder([
      'ok', 'teasing', 'smile', 'nice',
      'one-more-game', 'bring-it-on', 'you-sure', 'speed-game',
      'fighting', 'interesting', 'swagger', 'i-admit',
      'no-way', 'frustrated', 'crying', 'peekaboo',
      'dozing', 'study-time', 'wait', 'good-job',
      'hello', 'thank-you',
    ]),
  },
  {
    title: '김프랫·김프로그',
    emojis: pickInOrder([
      'rules-help', 'watching', 'bet', 'lagging',
      'champion', 'next-time', 'surrender',
    ]),
  },
];

/** 팟 채팅 피커의 평평한 목록. 검사와 개수 확인에 씁니다. */
export const POT_CHAT_EMOJIS: readonly ChatEmoji[] = POT_CHAT_EMOJI_SECTIONS.flatMap(
  (section) => section.emojis,
);

/** 게임방 피커의 평평한 목록. 검사와 개수 확인에 씁니다. */
export const GAME_CHAT_EMOJIS: readonly ChatEmoji[] = GAME_CHAT_EMOJI_SECTIONS.flatMap(
  (section) => section.emojis,
);

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
