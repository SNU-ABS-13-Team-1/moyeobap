import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { timeoutTurn } from "@/app/lib/omok";

/**
 * 착수 제한 시간이 지났다고 클라이언트가 알려오는 지점입니다. 실제 판정은
 * 서버가 DB의 turn_started_at으로 다시 하므로, 아직 시간이 남았으면 400으로
 * 거절됩니다. 양쪽 클라이언트가 동시에 호출해도 승부는 한 번만 확정됩니다.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
