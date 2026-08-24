import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { confirmScore } from "@/app/lib/baduk";

// 내 쪽의 계가 동의를 표시합니다. 양쪽이 모두 동의하면 서버가 집 계산을
// 확정하고 대국을 종료합니다.
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await confirmScore(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
