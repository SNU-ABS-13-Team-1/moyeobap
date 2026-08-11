import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, normalizeEmail, setSession } from "@/app/lib/auth";
import type { User } from "@/app/types/moyeobap";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  const bankAccount =
    typeof body?.bankAccount === "string" && body.bankAccount.trim()
      ? body.bankAccount.trim().slice(0, 60)
      : undefined;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  const user: User = { id: email, name, initial: name.charAt(0), bankAccount };
  await setSession(user);

  return NextResponse.json({ user });
}
