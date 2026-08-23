import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getRevealedAlbum, getRoom } from "@/app/lib/phoneOnline";

// 공개 단계의 앨범 하나(?index=). 방장이 넘긴 칸까지만 내려갑니다.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const room = await getRoom(id);
  if (!room) {
    return NextResponse.json({ error: "존재하지 않는 방이에요." }, { status: 404 });
  }
  const index = Number(request.nextUrl.searchParams.get("index"));
  const album = Number.isInteger(index) ? await getRevealedAlbum(room, index) : null;
  if (!album) {
    return NextResponse.json({ error: "아직 볼 수 없는 앨범이에요." }, { status: 400 });
  }
  return NextResponse.json({ album });
}
