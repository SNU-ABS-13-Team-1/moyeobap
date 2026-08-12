import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/lib/auth";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function isSafeAvatarUrl(value: string | null): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PUT(request: NextRequest) {
  const currentUser = await getSession();
  if (!currentUser) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const displayName = optionalText(body?.displayName, 40);
  const avatarUrl = optionalText(body?.avatarUrl, 500);
  const bankName = optionalText(body?.bankName, 30);
  const accountNumber = optionalText(body?.accountNumber, 40);

  if (!displayName) {
    return NextResponse.json({ error: "표시 이름을 입력해주세요." }, { status: 400 });
  }
  if (!isSafeAvatarUrl(avatarUrl)) {
    return NextResponse.json({ error: "프로필 이미지 주소를 확인해주세요." }, { status: 400 });
  }
  if ((bankName && !accountNumber) || (!bankName && accountNumber)) {
    return NextResponse.json(
      { error: "은행명과 계좌번호를 함께 입력해주세요." },
      { status: 400 },
    );
  }
  if (accountNumber && !/^[0-9 -]+$/.test(accountNumber)) {
    return NextResponse.json(
      { error: "계좌번호에는 숫자, 공백, 하이픈만 사용할 수 있어요." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").upsert({
    id: currentUser.id,
    display_name: displayName,
    avatar_url: avatarUrl,
    bank_name: bankName,
    account_number: accountNumber,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "프로필을 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      ...currentUser,
      name: displayName,
      initial: displayName.charAt(0),
      avatarUrl: avatarUrl ?? undefined,
      bankName: bankName ?? undefined,
      accountNumber: accountNumber ?? undefined,
    },
  });
}
