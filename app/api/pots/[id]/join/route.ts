import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { deriveStatus, getPot, savePot, toPotView } from "@/app/lib/backend";

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
    return NextResponse.json({ error: "이미 마감된 팟이에요." }, { status: 409 });
  }

  if (pot.participants.some((p) => p.id === user.id)) {
    return NextResponse.json({ pot: toPotView(pot, user) });
  }

  pot.participants.push({ ...user, joinedAt: Date.now() });
  pot.status = deriveStatus(pot);
  await savePot(pot);

  return NextResponse.json({ pot: toPotView(pot, user) });
}
