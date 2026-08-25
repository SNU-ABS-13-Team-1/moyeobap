import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/badukRanking";

export async function GET() {
  // 20위에서 자르지 않고 기록이 있는 사람을 전부 보여줍니다.
  const ranking = await getRanking();
  return NextResponse.json({ ranking });
}
