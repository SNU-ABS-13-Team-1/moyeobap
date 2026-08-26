import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getPot, toggleParticipantPaid, toPotView } from "@/app/lib/backend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const { id } = await params;
    const pot = await getPot(id);
    if (!pot) {
      return NextResponse.json({ error: "존재하지 않는 팟이에요." }, { status: 404 });
    }

    const isParticipant = pot.participants.some((p) => p.id === user.id);
    if (!isParticipant) {
      return NextResponse.json({ error: "팟 참여자만 송금 상태를 변경할 수 있어요." }, { status: 403 });
    }

    let targetUserId = user.id;
    try {
      const body = await req.json();
      if (typeof body?.targetIndex === "number") {
        const targetIndex = body.targetIndex;
        if (targetIndex < 0 || targetIndex >= pot.participants.length) {
          return NextResponse.json({ error: "참여자를 찾을 수 없어요." }, { status: 400 });
        }
        const targetParticipant = pot.participants[targetIndex];
        const isManager = pot.managerId === user.id;
        const isTargetMe = targetParticipant.id === user.id;
        if (!isManager && !isTargetMe) {
          return NextResponse.json(
            { error: "방장만 다른 참여자의 송금 상태를 변경할 수 있어요." },
            { status: 403 },
          );
        }
        targetUserId = targetParticipant.id;
      }
    } catch {
      // body가 없거나 JSON이 아닌 경우 본인 송금 상태로 진행
    }

    const updated = await toggleParticipantPaid(id, targetUserId);
    if (!updated) {
      return NextResponse.json({ error: "송금 상태를 변경하지 못했어요." }, { status: 500 });
    }

    return NextResponse.json({ pot: toPotView(updated, user) });
  } catch (error) {
    console.error("POST /api/pots/[id]/paid error:", error);
    return NextResponse.json(
      { error: "송금 상태 처리 중 오류가 발생했어요." },
      { status: 500 },
    );
  }
}
