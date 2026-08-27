import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { advancePhase, submitVote } from "@/app/lib/onenightOnline";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await submitVote(id, user.id, body?.seat);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // 마지막 한 표가 들어오면 바로 결과로 넘깁니다.
  const advanced = await advancePhase(id);
  return NextResponse.json({ room: "room" in advanced ? advanced.room : result.room });
}
