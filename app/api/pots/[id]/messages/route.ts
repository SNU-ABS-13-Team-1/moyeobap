import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { addMessage, getPot, listMessages } from "@/app/lib/backend";
import type { ChatMessage } from "@/app/types/moyeobap";

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
  return NextResponse.json({ messages });
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
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";
  if (!text) {
    return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  const message: ChatMessage = {
    id: randomUUID(),
    potId: id,
    authorId: user.id,
    authorName: user.name,
    text,
    createdAt: new Date().toISOString(),
  };
  await addMessage(message);

  return NextResponse.json({ message }, { status: 201 });
}
