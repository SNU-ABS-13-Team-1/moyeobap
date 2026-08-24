import { NextResponse } from "next/server";
import { TIME_CONTROL_LABEL, type TimeControl } from "@/app/lib/chessMatch";
import { mergeOpenRooms } from "@/app/lib/openRooms";
import { listRooms as listOmokRooms } from "@/app/lib/omok";
import { listRooms as listChessRooms } from "@/app/lib/chessOnline";
import { listRooms as listRummyRooms } from "@/app/lib/rummyOnline";
import { listRooms as listPhoneRooms } from "@/app/lib/phoneOnline";

// 미니게임 현황판(/games 하단)이 쓰는 통합 방 목록입니다. 게임별 로비 API는
// 그대로 두고, 여기서 네 게임의 목록을 합쳐 공통 형태로만 내려줍니다.
// 퐁은 미니게임 목록에서 빠져 있어(#30) 부르지 않습니다.
export async function GET() {
  // 한 게임이 실패해도 나머지는 보여줍니다. 각 listRooms()는 Supabase가 없거나
  // 조회에 실패하면 이미 빈 배열을 돌려주므로 여기서 따로 감싸지 않습니다.
  const [omok, chess, rummy, phone] = await Promise.all([
    listOmokRooms(),
    listChessRooms(),
    listRummyRooms(),
    listPhoneRooms(),
  ]);

  const rooms = mergeOpenRooms(
    { omok, chess, rummy, phone },
    { chessTimeLabel: (timeControl) => TIME_CONTROL_LABEL[timeControl as TimeControl] ?? null },
  );

  return NextResponse.json({ rooms });
}
