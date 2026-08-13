import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { pinPotMessage, toPotView } from "@/app/lib/backend";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const messageId = typeof body?.messageId === "string" ? body.messageId : null;

  const updatedPot = await pinPotMessage(id, messageId);
  if (!updatedPot) {
    return NextResponse.json(
      { error: "메시지 고정을 반영하지 못했어요." },
      { status: 400 },
    );
  }

  return NextResponse.json({ pot: toPotView(updatedPot, user) });
}
