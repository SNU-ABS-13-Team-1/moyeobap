import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { submitEntry } from "@/app/lib/phoneOnline";

// 이번 턴 내 칸 제출. body: { text } 또는 { image(PNG data URL) }
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await submitEntry(id, user.id, { text: body?.text, image: body?.image });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
