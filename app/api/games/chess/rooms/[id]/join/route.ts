import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { joinRoom } from "@/app/lib/chessOnline";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await joinRoom(id, user.id, user.name);

  if (result === null) {
    return NextResponse.json({ error: "존재하지 않는 방이에요." }, { status: 404 });
  }
  if (result === "self") {
    return NextResponse.json({ error: "내가 만든 방에는 참여할 수 없어요." }, { status: 400 });
  }
  if (result === "full") {
    return NextResponse.json({ error: "이미 다른 사람이 참여했어요." }, { status: 409 });
  }
  return NextResponse.json({ room: result });
}
