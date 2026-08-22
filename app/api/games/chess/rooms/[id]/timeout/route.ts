import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { timeoutTurn } from "@/app/lib/chessOnline";

// 착수 제한 시간이 지났다고 클라이언트가 알려오는 지점. 판정은 서버가 DB 기준으로 다시 합니다.
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
  return NextResponse.json({ room: result.room });
}
