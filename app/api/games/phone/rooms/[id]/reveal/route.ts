import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { setReveal } from "@/app/lib/phoneOnline";

// 방장이 앨범 공개 위치를 옮깁니다. body: { type: "next" | "prev" | "all" } 또는 { type: "album", album }
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const type = body?.type;
  const action =
    type === "album" ? ({ type: "album", album: Number(body?.album) } as const)
    : type === "prev" ? ({ type: "prev" } as const)
    : type === "all" ? ({ type: "all" } as const)
    : ({ type: "next" } as const);
  const result = await setReveal(id, user.id, action);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
