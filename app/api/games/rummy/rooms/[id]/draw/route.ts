import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { drawAndPass } from "@/app/lib/rummyOnline";

// 타일을 뽑고 넘기기. 더미가 비었으면 넘기기만 하고, 모두 넘기면 벌점 최소 승.
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await drawAndPass(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ room: "room" in result ? result.room : result });
}
