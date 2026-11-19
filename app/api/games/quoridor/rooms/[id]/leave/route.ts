import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { leaveRoom } from "@/app/lib/quoridorOnline";

// 나가기. 진행 중이면 기권입니다. 방이 지워졌으면 room은 null입니다.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const room = await leaveRoom(id, user.id);
  return NextResponse.json({ room });
}
