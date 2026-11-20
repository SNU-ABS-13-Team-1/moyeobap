import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { submitMove } from "@/app/lib/quoridorOnline";

// 수 두기. body.move = 표기("e2" 말 이동, "e3h" 벽). 서버가 규칙을 다시 검증합니다.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await submitMove(id, user.id, body?.move);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room, serverTime: new Date().toISOString() });
}
