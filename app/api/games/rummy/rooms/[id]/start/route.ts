import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { startGame } from "@/app/lib/rummyOnline";

// 방장이 시작: 타일 분배 + 무작위 선.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await startGame(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: "room" in result ? result.room : result });
}
