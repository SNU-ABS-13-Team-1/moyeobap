import { NextResponse } from "next/server";
import { TIME_CONTROL_LABEL, type TimeControl } from "@/app/lib/chessMatch";
import { mergeOpenRooms } from "@/app/lib/openRooms";
import { isFeatureEnabled } from "@/app/lib/featureFlags";
import { listRooms as listOmokRooms } from "@/app/lib/omok";
import { listRooms as listAlkkagiRooms } from "@/app/lib/alkkagi";
import { listRooms as listBadukRooms } from "@/app/lib/baduk";
import { listRooms as listChessRooms } from "@/app/lib/chessOnline";
import { listRooms as listRummyRooms } from "@/app/lib/rummyOnline";
import { listRooms as listPhoneRooms } from "@/app/lib/phoneOnline";
import { listRooms as listOneNightRooms } from "@/app/lib/onenightOnline";

let cachedRooms: { data: unknown; cachedAt: number } | null = null;
const ROOMS_CACHE_TTL_MS = 5_000;

// 미니게임 현황판(/games 하단)이 쓰는 통합 방 목록입니다. 게임별 로비 API는
// 그대로 두고, 여기서 각 게임의 목록을 합쳐 공통 형태로만 내려줍니다.
// 퐁은 미니게임 목록에서 빠져 있어(#30) 부르지 않습니다.
// Supabase DB Egress 방어를 위해 5초 동안 결과를 메모리에 캐싱합니다.
export async function GET() {
  const now = Date.now();
  if (cachedRooms && now - cachedRooms.cachedAt < ROOMS_CACHE_TTL_MS) {
    return NextResponse.json({ rooms: cachedRooms.data });
  }

  // 한 게임이 실패해도 나머지는 보여줍니다. 각 listRooms()는 Supabase가 없거나
  // 조회에 실패하면 이미 빈 배열을 돌려주므로 여기서 따로 감싸지 않습니다.
  // 플래그로 가려진 게임(바둑·알까기·원나잇)은 플래그를 확인합니다.
  const [alkkagiEnabled, badukEnabled, onenightEnabled] = await Promise.all([
    isFeatureEnabled("alkkagi"),
    isFeatureEnabled("baduk"),
    isFeatureEnabled("onenight"),
  ]);

  const [omok, alkkagi, baduk, chess, rummy, phone, onenight] = await Promise.all([
    listOmokRooms(),
    alkkagiEnabled ? listAlkkagiRooms() : Promise.resolve([]),
    badukEnabled ? listBadukRooms() : Promise.resolve([]),
    listChessRooms(),
    listRummyRooms(),
    listPhoneRooms(),
    onenightEnabled ? listOneNightRooms() : Promise.resolve([]),
  ]);

  const rooms = mergeOpenRooms(
    { omok, alkkagi, baduk, chess, rummy, phone, onenight },
    { chessTimeLabel: (timeControl) => TIME_CONTROL_LABEL[timeControl as TimeControl] ?? null },
  );

  cachedRooms = { data: rooms, cachedAt: now };
  return NextResponse.json({ rooms });
}
