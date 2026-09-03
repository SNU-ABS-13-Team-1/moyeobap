import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "../types/moyeobap";
import { getSupabaseConfig } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

import { cookies } from "next/headers";

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
  bank_name: string | null;
  account_number: string | null;
}

// 폴링이 잦아 매 요청마다 auth.getUser()와 profiles 조회가 반복되므로,
// 로그인에 성공한 세션만 짧게 캐싱합니다. 실패는 캐싱하지 않습니다.
// 네트워크 순단으로 getUser()가 한 번 실패했을 때 그 결과를 재사용하면
// 멀쩡히 로그인한 사람이 TTL 동안 로그아웃 상태로 보이기 때문입니다.
const cachedSessions = new Map<string, { user: User; cachedAt: number }>();
const SESSION_CACHE_TTL_MS = 15_000;
/** 쿠키가 갱신될 때마다 키가 바뀌므로, 죽은 항목이 쌓이지 않게 상한을 둡니다. */
const SESSION_CACHE_MAX_ENTRIES = 500;

export function invalidateSessionCache(): void {
  cachedSessions.clear();
}

function rememberSession(key: string, user: User, now: number): void {
  if (cachedSessions.size >= SESSION_CACHE_MAX_ENTRIES) {
    for (const [k, v] of cachedSessions) {
      if (now - v.cachedAt >= SESSION_CACHE_TTL_MS) cachedSessions.delete(k);
    }
    // 전부 살아 있으면(동시 접속 폭주) 가장 오래된 것부터 비웁니다.
    while (cachedSessions.size >= SESSION_CACHE_MAX_ENTRIES) {
      const oldest = cachedSessions.keys().next();
      if (oldest.done) break;
      cachedSessions.delete(oldest.value);
    }
  }
  cachedSessions.set(key, { user, cachedAt: now });
}

function metadataString(user: SupabaseUser, key: string): string | undefined {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function fallbackName(user: SupabaseUser): string {
  return (
    metadataString(user, "full_name") ??
    metadataString(user, "name") ??
    user.email?.split("@")[0] ??
    "사용자"
  ).slice(0, 40);
}

function toAppUser(authUser: SupabaseUser, profile: ProfileRow | null): User {
  const name = profile?.display_name?.trim() || fallbackName(authUser);
  const avatarUrl = profile?.avatar_url?.trim() || metadataString(authUser, "avatar_url");

  return {
    id: authUser.id,
    name,
    initial: name.charAt(0) || "밥",
    email: authUser.email ?? "",
    avatarUrl,
    bankName: profile?.bank_name?.trim() || undefined,
    accountNumber: profile?.account_number?.trim() || undefined,
  };
}

export async function getSession(): Promise<User | null> {
  if (!getSupabaseConfig()) return null;

  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  if (all.length === 0) return null;
  const authCookie = all.map((c) => `${c.name}=${c.value}`).join(";");

  const now = Date.now();
  const cached = cachedSessions.get(authCookie);
  if (cached && now - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    return cached.user;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bank_name, account_number")
    .eq("id", data.user.id)
    .maybeSingle<ProfileRow>();

  const appUser = toAppUser(data.user, profile ?? null);
  rememberSession(authCookie, appUser, now);
  return appUser;
}

export async function clearSession(): Promise<void> {
  if (!getSupabaseConfig()) return;
  invalidateSessionCache();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
}
