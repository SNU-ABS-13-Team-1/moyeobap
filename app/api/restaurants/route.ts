import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { listCustomRestaurants, saveCustomRestaurant } from "@/app/lib/backend";
import { RESTAURANTS } from "@/app/data/restaurants";
import type { Restaurant } from "@/app/types/moyeobap";

export async function GET() {
  const custom = await listCustomRestaurants();
  return NextResponse.json({ restaurants: [...RESTAURANTS, ...custom] });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const category = body?.category === "cafe" ? "cafe" : body?.category === "lunch" ? "lunch" : "";
  const address = typeof body?.address === "string" ? body.address.trim().slice(0, 200) : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : undefined;

  if (!name) {
    return NextResponse.json({ error: "매장 이름을 입력해주세요." }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "점심/카페 중 하나를 선택해주세요." }, { status: 400 });
  }

  const restaurant: Restaurant = {
    id: `custom-${randomUUID()}`,
    name,
    emoji: category === "cafe" ? "☕" : "🍽️",
    category,
    minOrder: 0,
    deliveryTime: "정보 없음",
    menus: [],
    address,
    phone,
    isCustom: true,
  };

  await saveCustomRestaurant(restaurant);
  return NextResponse.json({ restaurant }, { status: 201 });
}
