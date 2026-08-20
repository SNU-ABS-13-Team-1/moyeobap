import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { recordPoint } from "@/app/lib/pong";

// 방장(player1) 브라우저가 물리 시뮬레이션을 돌리다가 공이 벽을 통과한
// 순간 호출합니다. 서버가 실제로 player1인지, playing 상태인지, 점수가
// 딱 1점씩만 오르는지를 검증합니다(app/lib/pong.ts의 recordPoint 참고).
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
  const scorer = body?.scorer;

  if (scorer !== "player1" && scorer !== "player2") {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await recordPoint(id, user.id, scorer);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
