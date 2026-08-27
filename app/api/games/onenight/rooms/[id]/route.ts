import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { advancePhase, getPrivateView, getRoom } from "@/app/lib/onenightOnline";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // 방을 보고 있는 사람의 폴링이 단계 넘기기도 겸합니다(별도 스케줄러 없음).
  // 동시에 여러 명이 불러도 version 조건 때문에 한 번만 처리됩니다.
  const advanced = await advancePhase(id);
  const room = "room" in advanced ? advanced.room : await getRoom(id);
  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없어요." }, { status: 404 });
  }

  const user = await getSession();
  const view = user ? await getPrivateView(room, user.id) : null;
  return NextResponse.json({ room, view });
}
