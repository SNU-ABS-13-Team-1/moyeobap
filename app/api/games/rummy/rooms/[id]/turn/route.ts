import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { submitTurn } from "@/app/lib/rummyOnline";

// 턴 종료: body.table = 최종 테이블(타일 id 배열의 배열). 서버가 손패 기준으로 규칙을 다시 검증합니다.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await submitTurn(id, user.id, body?.table);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
