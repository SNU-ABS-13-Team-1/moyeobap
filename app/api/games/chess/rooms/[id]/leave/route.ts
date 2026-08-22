import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { leaveRoom } from "@/app/lib/chessOnline";

// 대기 중 방이면 삭제, 대국 중이면 기권(상대 승), 종료 후엔 재대국 신청만 정리합니다.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  await leaveRoom(id, user.id);
  return NextResponse.json({ success: true });
}
