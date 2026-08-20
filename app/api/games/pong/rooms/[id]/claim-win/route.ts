import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { claimDisconnectWin } from "@/app/lib/pong";

// 상대가 대전 중 연결이 끊긴 뒤 일정 시간(클라이언트에서 60초로 판단)
// 돌아오지 않을 때, 남은 플레이어가 직접 승리 처리하는 엔드포인트입니다.
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await claimDisconnectWin(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
