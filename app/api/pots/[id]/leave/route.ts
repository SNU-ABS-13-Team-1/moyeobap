import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { deriveStatus, getPot, logEvent, savePot, toPotView } from "@/app/lib/backend";

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

  const currentStatus = deriveStatus(pot);
  if (currentStatus !== "active") {
    if (currentStatus !== pot.status) await savePot({ ...pot, status: currentStatus });
    return NextResponse.json(
      { error: "모집 마감 뒤에는 참여를 취소할 수 없어요." },
      { status: 409 },
    );
  }

  const wasParticipating = pot.participants.some((participant) => participant.id === user.id);
  if (!wasParticipating) {
    return NextResponse.json({ pot: toPotView(pot, user) });
  }

  const wasManager = pot.managerId === user.id;
  pot.participants = pot.participants.filter((p) => p.id !== user.id);
  if (pot.participants.length === 0) {
    pot.status = "failed";
    pot.managerId = null;
  } else if (wasManager) {
    pot.managerId = pot.participants[0].id;
  }
  const saved = await savePot(pot);
  if (!saved) {
    return NextResponse.json(
      { error: "참여 취소를 저장하지 못했어요. 잠시 뒤 다시 시도해주세요." },
      { status: 503 },
    );
  }
  await logEvent("pot_left", pot, user.id);
  if (pot.status === "failed") {
    await logEvent("pot_failed", pot);
  }

  return NextResponse.json({ pot: toPotView(pot, user) });
}
