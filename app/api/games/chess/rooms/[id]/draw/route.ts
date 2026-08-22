import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { acceptDraw, declineDraw, offerDraw } from "@/app/lib/chessOnline";

type DrawAction = "offer" | "accept" | "decline";

const HANDLERS: Record<DrawAction, (roomId: string, userId: string) => Promise<unknown>> = {
  offer: offerDraw,
  accept: acceptDraw,
  decline: declineDraw,
};

function isDrawAction(value: unknown): value is DrawAction {
  return value === "offer" || value === "accept" || value === "decline";
}

// 무승부 제안(offer) → 상대 수락(accept)이면 합의 무승부로 종료, 거절(decline)이면 제안만 사라집니다.
// 제안 뒤 누군가 수를 두면 제안은 자동으로 없어집니다(app/lib/chessOnline.ts submitMove).
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!isDrawAction(action)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await HANDLERS[action](id, user.id);
  if (result && typeof result === "object" && "error" in result) {
    return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
  }
  return NextResponse.json({ room: result });
}
