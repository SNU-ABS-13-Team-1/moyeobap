import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getCampusStats, getMyStatsReport } from "@/app/lib/backend";

export async function GET() {
  try {
    const campusStats = await getCampusStats();
    const user = await getSession();
    const myStats = user ? await getMyStatsReport(user.id) : null;

    return NextResponse.json({
      campus: campusStats,
      my: myStats,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json({ error: "통계 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
