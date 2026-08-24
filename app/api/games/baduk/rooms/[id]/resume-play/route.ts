import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { resumePlay } from "@/app/lib/baduk";

// 계가 합의가 안 될 때, 죽은 돌 표시를 지우고 다시 두는 단계로 돌아갑니다.
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await resumePlay(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
