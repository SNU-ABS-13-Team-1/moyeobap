import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { resignGame } from "@/app/lib/quoridorOnline";

// 기권. 이 판에서 지지만 방에는 참여자로 남아 관전하고 다시 하기에 낍니다(나가기는 leave).
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await resignGame(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room, serverTime: new Date().toISOString() });
}
