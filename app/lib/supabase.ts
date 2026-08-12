import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabase/config";

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const config = getSupabaseConfig();
  if (!config || config.url.includes("your-project-ref")) return null;

  supabaseClient = createClient(config.url, config.publishableKey, {
    auth: {
      // 사용자 세션은 @supabase/ssr 기반 browser/server 클라이언트가 관리합니다.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
