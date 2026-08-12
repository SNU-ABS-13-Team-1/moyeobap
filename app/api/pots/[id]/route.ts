import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { deriveStatus, getAnyRestaurant, getPot, savePot, toPotView } from "@/app/lib/backend";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  const { id } = await context.params;

  if (process.env.NODE_ENV === "development" && id === "preview") {
    const deadline = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    return NextResponse.json({
      pot: {
        id: "preview",
        restaurantId: "preview-restaurant",
        deadline,
        participantCount: 4,
        participants: null,
        isParticipating: false,
        isManaging: false,
        status: "active",
        maxParticipants: 8,
      },
      restaurant: {
        id: "preview-restaurant",
        name: "모여밥 키친 배곧점",
        emoji: "🍱",
        category: "lunch",
        subCategory: "한식",
        minOrder: 18000,
        deliveryTime: "30~40분",
        menus: [
          { name: "직화 제육 덮밥", price: "10,900원" },
          { name: "소불고기 덮밥", price: "12,900원" },
          { name: "닭갈비 덮밥", price: "11,900원" },
        ],
        address: "경기 시흥시 배곧동",
      },
    });
  }

  const pot = await getPot(id);

  if (!pot) {
    return NextResponse.json({ error: "존재하지 않는 팟이에요." }, { status: 404 });
  }

  const status = deriveStatus(pot);
  const currentPot = status === pot.status ? pot : { ...pot, status };
  if (currentPot !== pot) await savePot(currentPot);

  if (currentPot.status === "failed") {
    return NextResponse.json({ error: "종료된 팟이에요." }, { status: 410 });
  }

  const restaurant = await getAnyRestaurant(currentPot.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ error: "매장 정보를 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ pot: toPotView(currentPot, user), restaurant });
}
