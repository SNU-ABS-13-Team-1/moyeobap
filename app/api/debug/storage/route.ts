import { NextResponse } from "next/server";
import { isStorageConfigured } from "@/app/lib/kv";

/**
 * Redis 연결 여부만 알려주는 진단용 엔드포인트입니다. 비밀값은 노출하지 않고
 * "설정돼 있다/없다"만 반환합니다. 배포된 URL에 /api/debug/storage로 접속하면
 * 확인할 수 있어요.
 */
export async function GET() {
  const redisConfigured = isStorageConfigured();
  return NextResponse.json({
    redisConfigured,
    note: redisConfigured
      ? "Redis에 연결되어 있어요. 방 데이터가 서버리스 인스턴스와 무관하게 유지됩니다."
      : "Redis가 연결되지 않았어요. 방 데이터가 인스턴스 메모리에만 저장돼서 인스턴스마다 다르게 보일 수 있어요.",
  });
}
