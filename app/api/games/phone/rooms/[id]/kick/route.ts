import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { kickPlayer } from "@/app/lib/phoneOnline";

// 방장이 대기 중인 방에서 자리를 비운 사람을 내보냅니다. body: { userId }
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const targetId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetId) {
    return NextResponse.json({ error: "내보낼 사람을 지정해주세요." }, { status: 400 });
  }

  const result = await kickPlayer(id, user.id, targetId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result });
}
