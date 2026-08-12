import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "../types/moyeobap";
import { getSupabaseConfig } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
  bank_name: string | null;
  account_number: string | null;
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bank_name, account_number")
    .eq("id", data.user.id)
    .maybeSingle<ProfileRow>();

  return toAppUser(data.user, profile ?? null);
}

export async function clearSession(): Promise<void> {
  if (!getSupabaseConfig()) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
}
