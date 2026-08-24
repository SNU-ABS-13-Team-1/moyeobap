import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { resign } from "@/app/lib/omok";

// "기권하기" 버튼의 서버 처리입니다. 그 판은 상대의 승리로 기록되지만, 방에서
// 자리를 빼지는 않습니다(나가기는 leave가 맡습니다). 기권한 사람도 그대로
// 방에 남아 결과와 재대국 신청를 볼 수 있습니다.
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await resign(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
