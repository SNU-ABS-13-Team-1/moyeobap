import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { acceptRematch, declineRematch, requestRematch } from "@/app/lib/chessOnline";

type RematchAction = "request" | "accept" | "decline";

const HANDLERS: Record<RematchAction, (roomId: string, userId: string) => Promise<unknown>> = {
  request: requestRematch,
  accept: acceptRematch,
  decline: declineRematch,
};

function isRematchAction(value: unknown): value is RematchAction {
  return value === "request" || value === "accept" || value === "decline";
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!isRematchAction(action)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await HANDLERS[action](id, user.id);
  if (result && typeof result === "object" && "error" in result) {
    return NextResponse.json({ error: (result as { error: string }).error }, { status: 400 });
  }
  return NextResponse.json({ room: result });
}
