import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getChatEmojiById } from "@/app/data/chat-emojis";
import { getRoomChat, postRoomChat } from "@/app/lib/omokChat";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const messages = await getRoomChat(id);
  return NextResponse.json({ messages });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  let text: string;
  let kind: "text" | "image" = "text";
  if (body && typeof body === "object" && "emojiId" in body) {
    // 모여밥 이모티콘: 클라이언트가 보낸 경로를 그대로 믿지 않고, 서버가
    // 아는 화이트리스트(app/data/chat-emojis.ts)에서만 실제 경로를 가져옵니다.
    const emoji = getChatEmojiById(body.emojiId);
    if (!emoji) {
      return NextResponse.json({ error: "올바르지 않은 이모티콘이에요." }, { status: 400 });
    }
    text = emoji.src;
    kind = "image";
  } else {
    text = typeof body?.text === "string" ? body.text : "";
  }

  const result = await postRoomChat(id, user.id, user.name, text, kind);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ message: result }, { status: 201 });
}
