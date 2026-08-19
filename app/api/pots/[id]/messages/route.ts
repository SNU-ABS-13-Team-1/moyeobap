import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { addMessage, getPot, listMessages, markPotMessagesRead } from "@/app/lib/backend";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import { getChatEmojiById } from "@/app/data/chat-emojis";
import type { ChatMessage, ChatMessageView } from "@/app/types/moyeobap";

async function requireParticipant(potId: string, userId: string) {
  const pot = await getPot(potId);
  if (!pot) return { error: "존재하지 않는 팟이에요.", status: 404 } as const;
  if (!pot.participants.some((p) => p.id === userId)) {
    return { error: "팟 참여자만 채팅을 볼 수 있어요.", status: 403 } as const;
  }
  return { pot } as const;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const check = await requireParticipant(id, user.id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const messages = await listMessages(id);
  const supabase = await createSupabaseServerClient();
  await markPotMessagesRead(id, user.id, messages, supabase);
  const view: ChatMessageView[] = messages.map((message) => ({
    id: message.id,
    authorName: message.authorName,
    text: message.text,
    createdAt: message.createdAt,
    kind: message.kind,
    imageUrl: message.imageUrl,
    isMine: message.authorId === user.id,
  }));
  return NextResponse.json({ messages: view });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const check = await requireParticipant(id, user.id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);

  let text: string;
  let kind: ChatMessage["kind"] = "text";
  let imageUrl: string | undefined;

  if (body?.shareAccount === true) {
    // 계좌번호는 클라이언트가 보낸 텍스트를 그대로 믿지 않고, 로그인 세션에 저장된
    // 값에서만 가져옵니다 — 그래야 다른 사람 계좌인 척 보내는 걸 막을 수 있어요.
    if (!user.bankName || !user.accountNumber) {
      return NextResponse.json({ error: "등록된 계좌번호가 없어요." }, { status: 400 });
    }
    text = `💳 ${user.name}님 계좌번호: ${user.bankName} ${user.accountNumber}`;
    kind = "account";
  } else if (body && typeof body === "object" && "emojiId" in body) {
    const emoji = getChatEmojiById(body.emojiId);
    if (!emoji) {
      return NextResponse.json({ error: "올바르지 않은 이모티콘이에요." }, { status: 400 });
    }
    imageUrl = emoji.src;
    text = emoji.src;
    kind = "image";
  } else if (typeof body?.imageUrl === "string" && body.imageUrl.trim()) {
    const rawImage = body.imageUrl.trim();
    // 5MB 바이너리 기준 Base64 길이는 약 7MB (7 * 1024 * 1024)
    if (rawImage.length > 7.5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "이미지 크기가 너무 큽니다. 5MB 이하의 이미지만 전송할 수 있어요." },
        { status: 400 },
      );
    }
    if (!rawImage.startsWith("data:image/") && !/^https?:\/\//i.test(rawImage)) {
      return NextResponse.json(
        { error: "올바른 이미지 형식이 아닙니다." },
        { status: 400 },
      );
    }
    imageUrl = rawImage;
    // imageUrl 컬럼이 따로 없으므로 실제 경로를 messages.text에 저장합니다.
    text = rawImage;
    kind = "image";
  } else if (typeof body?.orderLink === "string" && body.orderLink.trim()) {
    const rawLink = body.orderLink.trim();
    if (!/^https?:\/\//i.test(rawLink)) {
      return NextResponse.json(
        { error: "올바른 웹 링크(http:// 또는 https://)를 입력해주세요." },
        { status: 400 },
      );
    }
    text = rawLink.slice(0, 1000);
    kind = "order_link";
  } else {
    text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";
    if (!text) {
      return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
    }
  }

  const message: ChatMessage = {
    id: randomUUID(),
    potId: id,
    authorId: user.id,
    authorName: user.name,
    text,
    createdAt: new Date().toISOString(),
    kind,
    imageUrl,
  };
  const saved = await addMessage(message);
  if (!saved) {
    return NextResponse.json(
      { error: "메시지를 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." },
      { status: 503 },
    );
  }

  const view: ChatMessageView = {
    id: message.id,
    authorName: message.authorName,
    text: message.text,
    createdAt: message.createdAt,
    kind: message.kind,
    imageUrl: message.imageUrl,
    isMine: true,
  };
  return NextResponse.json({ message: view }, { status: 201 });
}
