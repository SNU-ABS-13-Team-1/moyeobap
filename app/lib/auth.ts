import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "../types/moyeobap";

const COOKIE_NAME = "moyeobap_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const LOCAL_SESSION_SECRET = "moyeobap-local-development-session-secret";

function getSessionSecret(): string {
  const secret = process.env.MOYEOBAP_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MOYEOBAP_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  return LOCAL_SESSION_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<User>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.initial === "string" &&
    (user.bankAccount === undefined || typeof user.bankAccount === "string")
  );
}

/**
 * 로그인은 이메일 입력뿐입니다 (비밀번호·인증코드 없음). 같은 이메일로 다시
 * 들어오면 같은 사람으로 인식되도록 이메일을 그대로 사용자 id로 씁니다.
 */
export async function getSession(): Promise<User | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const separator = raw.lastIndexOf(".");
    if (separator < 1) return null;

    const encodedPayload = raw.slice(0, separator);
    const receivedSignature = Buffer.from(raw.slice(separator + 1), "base64url");
    const expectedSignature = Buffer.from(sign(encodedPayload), "base64url");
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    return isUser(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function setSession(user: User): Promise<void> {
  const store = await cookies();
  const payload = Buffer.from(JSON.stringify(user), "utf-8").toString("base64url");
  const raw = `${payload}.${sign(payload)}`;
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
