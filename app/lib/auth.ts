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

const cachedSessions = new Map<string, { user: User | null; cachedAt: number }>();
const SESSION_CACHE_TTL_MS = 15_000;

export function invalidateSessionCache(): void {
  cachedSessions.clear();
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
  if (error || !data.user) {
    cachedSessions.set(authCookie, { user: null, cachedAt: now });
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bank_name, account_number")
    .eq("id", data.user.id)
    .maybeSingle<ProfileRow>();

  const appUser = toAppUser(data.user, profile ?? null);
  cachedSessions.set(authCookie, { user: appUser, cachedAt: now });
  return appUser;
}

export async function clearSession(): Promise<void> {
  if (!getSupabaseConfig()) return;
  invalidateSessionCache();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
}
