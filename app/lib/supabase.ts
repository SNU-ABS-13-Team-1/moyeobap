import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabase/config";

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const config = getSupabaseConfig();
  if (!config || config.url.includes("your-project-ref")) return null;

  // 핵심 테이블의 RLS는 브라우저 공개 키에 쓰기 권한을 주지 않습니다.
  // 서버 API만 service-role 키로 DB를 읽고 수정하며, 로컬 개발에서는 보안
  // migration 적용 전 호환을 위해 publishable key로 fallback 합니다.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const serverKey = serviceRoleKey || config.publishableKey;

  supabaseClient = createClient(config.url, serverKey, {
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

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
