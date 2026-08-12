import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { deriveStatus, getPot, logEvent, savePot, toPublicPot } from "@/app/lib/backend";

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

  if (deriveStatus(pot) !== "active") {
    return NextResponse.json({ error: "이미 마감된 팟이에요." }, { status: 409 });
  }

  if (pot.participants.some((p) => p.id === user.id)) {
    return NextResponse.json({ pot: toPublicPot(pot, user.id) });
  }

  pot.participants.push({ ...user, joinedAt: Date.now() });
  pot.status = deriveStatus(pot);
  await savePot(pot);
  await logEvent("pot_joined", pot, user.id);
  // 이 참여로 정원이 차서 바로 마감된 경우, 마감도 별도 사건으로 남깁니다.
  if (pot.status !== "active") {
    await logEvent(pot.status === "closed" ? "pot_closed" : "pot_failed", pot);
  }

  return NextResponse.json({ pot: toPublicPot(pot, user.id) });
}
