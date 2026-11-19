import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getRoom } from "@/app/lib/quoridorOnline";

// 방 상태(숨긴 정보가 없어 참여자·관전자 모두 같은 응답). 실시간 대전이라 CDN 캐시를 걸지 않습니다.
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const room = await getRoom(id);
  if (!room) {
    return NextResponse.json({ error: "존재하지 않는 방이에요." }, { status: 404 });
  }
  return NextResponse.json({ room });
}
