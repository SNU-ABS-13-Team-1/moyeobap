import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { submitMove } from "@/app/lib/chessOnline";

const SQUARE = /^[a-h][1-8]$/;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const from = typeof body?.from === "string" ? body.from : "";
  const to = typeof body?.to === "string" ? body.to : "";
  const promotion = typeof body?.promotion === "string" ? body.promotion : undefined;

  if (!SQUARE.test(from) || !SQUARE.test(to)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const result = await submitMove(id, user.id, from, to, promotion);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: result.room });
}
