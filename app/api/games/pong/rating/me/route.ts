import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getMyRating } from "@/app/lib/pongRanking";

// 결과 화면에서 "Rating +18" 같은 변동폭을 보여주기 위해, 클라이언트가 방
// 입장 시점과 종료 후 시점에 각각 호출해서 비교합니다.
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const rating = await getMyRating(user.id, user.name);
  return NextResponse.json({ rating });
}
