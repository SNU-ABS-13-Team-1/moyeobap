import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { acceptScoring, declineScoring, offerScoring } from "@/app/lib/baduk";

type ScoreOfferAction = "offer" | "accept" | "decline";

const HANDLERS: Record<
  ScoreOfferAction,
  (roomId: string, userId: string) => Promise<{ room: unknown } | { error: string }>
> = {
  offer: offerScoring,
  accept: acceptScoring,
  decline: declineScoring,
};

function isScoreOfferAction(value: unknown): value is ScoreOfferAction {
  return value === "offer" || value === "accept" || value === "decline";
}

// 계가 신청(offer) → 상대 수락(accept)이면 계가 단계로 넘어가고, 거절(decline)이면
// 신청만 사라집니다. 신청 뒤 누군가 수를 두거나 패스하면 신청은 자동으로
// 없어집니다(app/lib/baduk.ts submitMove·submitPass).
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!isScoreOfferAction(action)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await HANDLERS[action](id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
