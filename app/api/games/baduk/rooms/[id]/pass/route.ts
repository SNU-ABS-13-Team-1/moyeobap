import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { submitPass } from "@/app/lib/baduk";

// 패스합니다. 연속 패스가 2번이 되면 서버가 자동으로 계가(scoring) 단계로
// 넘깁니다(app/lib/baduk.ts의 submitPass 참고).
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await submitPass(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
