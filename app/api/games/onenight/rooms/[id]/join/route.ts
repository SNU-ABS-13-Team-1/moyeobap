import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { joinRoom } from "@/app/lib/onenightOnline";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { id } = await context.params;
  const result = await joinRoom(id, user.id, user.name, user.avatarUrl);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ room: result.room });
}
