import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { restartGame } from "@/app/lib/quoridorOnline";

// 끝난 방에서 방장이 다시 시작. 인원이 모자라면 대기 상태로 돌아갑니다.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await restartGame(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
