import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { toPotView, updateParticipantMemo } from "@/app/lib/backend";

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
  const memo = typeof body?.memo === "string" ? body.memo : "";

  const updatedPot = await updateParticipantMemo(id, user.id, memo);
  if (!updatedPot) {
    return NextResponse.json(
      { error: "주문 메모를 저장하지 못했어요." },
      { status: 400 },
    );
  }

  return NextResponse.json({ pot: toPotView(updatedPot, user) });
}
