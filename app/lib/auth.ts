import { cookies } from "next/headers";
import type { User } from "../types/moyeobap";

const COOKIE_NAME = "moyeobap_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/**
 * 로그인은 이메일 입력뿐입니다 (비밀번호·인증코드 없음). 같은 이메일로 다시
 * 들어오면 같은 사람으로 인식되도록 이메일을 그대로 사용자 id로 씁니다.
 */
export async function getSession(): Promise<User | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as User;
    if (!payload.id || !payload.name) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSession(user: User): Promise<void> {
  const store = await cookies();
  const raw = Buffer.from(JSON.stringify(user), "utf-8").toString("base64url");
  store.set(COOKIE_NAME, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
