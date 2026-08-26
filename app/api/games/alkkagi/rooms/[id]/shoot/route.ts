import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { submitShot } from "@/app/lib/alkkagi";

/**
 * 오목의 /move 자리에 들어가는, 알까기의 유일한 착수 지점입니다.
 * 클라이언트가 보내는 건 "어느 돌을 어느 속도로" 세 값뿐이고, 물리는 서버가
 * 다시 돌려 결과를 확정합니다(app/lib/alkkagi.ts의 submitShot).
 */
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
  const stoneId = body?.stoneId;
  const vx = Number(body?.vx);
  const vy = Number(body?.vy);

  if (typeof stoneId !== "string" || !Number.isFinite(vx) || !Number.isFinite(vy)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await submitShot(id, user.id, { stoneId, vx, vy });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
