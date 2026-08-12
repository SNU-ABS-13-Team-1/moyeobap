import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getPot, logEvent, savePot } from "@/app/lib/backend";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const pot = await getPot(id);
  if (!pot) {
    return NextResponse.json({ error: "존재하지 않는 팟이에요." }, { status: 404 });
  }

  if (pot.status !== "active") {
    return NextResponse.json({ pot });
  }

  pot.participants = pot.participants.filter((p) => p.id !== user.id);
  // 방장(맨 처음 참여자)이 나가면 다음 참여자가 자동으로 그 자리를 물려받습니다
  // (배열 순서가 곧 방장 판정 기준이라 별도 필드 없이 자연스럽게 처리됩니다).
  if (pot.participants.length === 0) {
    pot.status = "failed";
  }
  await savePot(pot);
  await logEvent("pot_left", pot, user.id);
  if (pot.status === "failed") {
    await logEvent("pot_failed", pot);
  }

  return NextResponse.json({ pot });
}
