import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { createRoom, listRooms } from "@/app/lib/quoridorOnline";
import { DEFAULT_TURN_LIMIT_SEC } from "@/app/lib/quoridorRoom";

export async function GET() {
  const rooms = await listRooms();
  return NextResponse.json({ rooms });
}

// body: { roomName?, mode: 2 | 4, turnLimitSec? }
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const mode = Number(body?.mode);
  if (mode !== 2 && mode !== 4) {
    return NextResponse.json({ error: "2인전 또는 4인전을 골라주세요." }, { status: 400 });
  }
  const roomName = typeof body?.roomName === "string" ? body.roomName : undefined;
  const turnLimitSec = Number(body?.turnLimitSec);

  const room = await createRoom(user.id, user.name, roomName, mode, Number.isFinite(turnLimitSec) ? turnLimitSec : DEFAULT_TURN_LIMIT_SEC);
  if (!room) {
    return NextResponse.json({ error: "방을 만들지 못했어요. 잠시 뒤 다시 시도해주세요." }, { status: 503 });
  }
  return NextResponse.json({ room }, { status: 201 });
}
