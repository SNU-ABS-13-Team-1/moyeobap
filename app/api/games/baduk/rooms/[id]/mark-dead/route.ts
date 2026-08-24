import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { markDeadGroup } from "@/app/lib/baduk";

// 계가 중 돌 그룹의 죽음/삶 표시를 토글합니다.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const row = Number(body?.row);
  const col = Number(body?.col);

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await markDeadGroup(id, user.id, row, col);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
