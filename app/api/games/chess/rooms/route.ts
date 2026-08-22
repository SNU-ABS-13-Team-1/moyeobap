import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { createRoom, listRooms } from "@/app/lib/chessOnline";

export async function GET() {
  const rooms = await listRooms();
  return NextResponse.json({ rooms });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roomName = typeof body?.roomName === "string" ? body.roomName : undefined;

  const room = await createRoom(user.id, user.name, roomName);
  if (!room) {
    return NextResponse.json({ error: "방을 만들지 못했어요. 잠시 뒤 다시 시도해주세요." }, { status: 503 });
  }
  return NextResponse.json({ room }, { status: 201 });
}
