import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getRoom, getTask } from "@/app/lib/phoneOnline";

// 진행 중인 턴에서 "내가 받은 앞 칸"과 제출 상태. 다른 사람의 칸은 내려가지 않습니다.
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
  const task = await getTask(room, user.id);
  return NextResponse.json({ task });
}
