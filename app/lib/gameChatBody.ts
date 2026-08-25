/**
 * 게임 채팅 POST 본문을 저장할 형태로 바꿉니다.
 *
 * 이모티콘은 클라이언트가 보낸 경로를 그대로 믿지 않고, 서버가 아는
 * 화이트리스트에서만 실제 경로를 가져옵니다. 게임마다 라우트가 따로 있어서
 * 같은 검증을 여섯 번 복붙하지 않도록 여기 한 곳에 모읍니다.
 *
 * 화이트리스트 조회는 인자로 받습니다 — 이 모듈은 다른 모듈을 import하지
 * 않아야 테스트 러너(node --experimental-strip-types)에서 그대로 돌아갑니다.
 * 이 레포의 다른 순수 모듈(openRooms, gameSeats)도 같은 규칙을 따릅니다.
 *
 * 길이·공백 검증은 각 게임의 postRoomChat이 이미 하고 있어서 여기서는
 * 하지 않습니다.
 */
export type ChatBody = { text: string; kind: "text" | "image" };

/** app/data/chat-emojis.ts의 getChatEmojiById를 그대로 넘기면 됩니다. */
export type EmojiLookup = (id: string) => { src: string } | undefined;

export function parseChatBody(
  body: unknown,
  findEmoji: EmojiLookup,
): ChatBody | { error: string } {
  if (body && typeof body === "object" && "emojiId" in body) {
    const emojiId = (body as { emojiId: unknown }).emojiId;
    if (typeof emojiId !== "string") {
      return { error: "올바르지 않은 이모티콘이에요." };
    }
    const emoji = findEmoji(emojiId);
    if (!emoji) {
      return { error: "올바르지 않은 이모티콘이에요." };
    }
    return { text: emoji.src, kind: "image" };
  }

  const text =
    body && typeof body === "object" && typeof (body as { text: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  return { text, kind: "text" };
}
