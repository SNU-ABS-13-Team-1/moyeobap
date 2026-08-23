import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { timeoutTurn } from "@/app/lib/rummyOnline";

// 턴 제한 시간 초과 신고. 서버가 시각을 다시 확인하고 현재 차례 사람이 타일 1장을 뽑고 넘긴 것으로 처리합니다.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await timeoutTurn(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: "room" in result ? result.room : result });
}
