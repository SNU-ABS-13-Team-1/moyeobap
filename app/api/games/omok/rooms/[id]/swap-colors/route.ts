import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { swapColors } from "@/app/lib/omok";

// "흑/백 전환" 버튼의 서버 처리입니다. 참여자(흑/백)만 호출할 수 있고,
// 대국 중(playing)에는 항상 거부됩니다(app/lib/omok.ts의 swapColors 참고).
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await swapColors(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result });
}
