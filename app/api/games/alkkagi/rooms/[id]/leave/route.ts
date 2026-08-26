import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { leaveRoom } from "@/app/lib/alkkagi";

// "게임 나가기" 버튼의 서버 처리입니다. 대기 중 방이면 삭제되고, 게임 중
// 방이면 나가는 사람이 기권 처리되어 상대가 승리합니다 (app/lib/alkkagi.ts의
// leaveRoom 참고).
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  await leaveRoom(id, user.id);

  return NextResponse.json({ success: true });
}
