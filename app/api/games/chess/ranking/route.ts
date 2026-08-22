import { NextResponse } from "next/server";
import { getChessRanking } from "@/app/lib/chessRanking";

export async function GET() {
  const ranking = await getChessRanking(20);
  return NextResponse.json({ ranking });
}
