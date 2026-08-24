import { NextResponse } from "next/server";
import { getRanking } from "@/app/lib/badukRanking";

export async function GET() {
  const ranking = await getRanking(20);
  return NextResponse.json({ ranking });
}
