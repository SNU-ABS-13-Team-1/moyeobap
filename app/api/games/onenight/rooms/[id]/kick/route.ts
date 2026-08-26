import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { kickPlayer } from "@/app/lib/onenightOnline";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  if (!targetId) return NextResponse.json({ error: "누구를 내보낼지 알 수 없어요." }, { status: 400 });

  const result = await kickPlayer(id, user.id, targetId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ room: result.room });
}
