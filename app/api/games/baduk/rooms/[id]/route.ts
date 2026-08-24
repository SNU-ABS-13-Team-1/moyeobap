import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getRoom } from "@/app/lib/baduk";

// 참여자뿐 아니라 관전자도 방 상태를 볼 수 있어야 하므로, 로그인 여부만
// 확인하고 흑/백 여부는 체크하지 않습니다.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
