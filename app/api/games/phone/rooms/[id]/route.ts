import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getAlbumSummaries, getRoom } from "@/app/lib/phoneOnline";

// 방의 공개 상태 + (공개 단계면) 앨범 목록 요약. 칸 내용은 /task(진행 중)·/album(공개 중)으로 따로 받습니다.
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
  const albums = await getAlbumSummaries(room);
  return NextResponse.json({ room, albums });
}
