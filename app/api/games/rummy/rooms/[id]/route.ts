import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getHand, getRoom } from "@/app/lib/rummyOnline";

// 방 공개 상태 + (참여자면) 내 손패. 다른 사람의 손패는 절대 내려가지 않습니다.
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
  const isPlayer = room.players.some((p) => p.id === user.id && !p.left);
  const myHand = isPlayer && room.status !== "waiting" ? await getHand(id, user.id) : null;
  return NextResponse.json({ room, myHand });
}
