import { NextResponse } from "next/server";
import { getChessRanking, getRecentChessMatches } from "@/app/lib/chessRanking";

export async function GET() {
  const [ranking, recent] = await Promise.all([getChessRanking(20), getRecentChessMatches(10)]);
  return NextResponse.json({ ranking, recent });
}
