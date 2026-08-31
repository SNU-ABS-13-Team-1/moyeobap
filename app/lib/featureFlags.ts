import { getSupabase } from "./supabase";

const FLAG_CACHE_TTL_MS = 60_000;
const flagCache = new Map<string, { enabled: boolean; cachedAt: number }>();

/**
 * DB의 app_flags 테이블을 조회합니다. 테이블이 아직 없거나(마이그레이션
 * 미실행) 조회에 실패하면 항상 false를 반환합니다(fail-closed).
 * Supabase DB Egress 방어를 위해 60초 동안 결과를 메모리에 캐싱합니다.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const now = Date.now();
  const cached = flagCache.get(key);
  if (cached && now - cached.cachedAt < FLAG_CACHE_TTL_MS) {
    return cached.enabled;
  }

  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("app_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle<{ enabled: boolean }>();

  if (error || !data) return false;
  const isEnabled = data.enabled === true;
  flagCache.set(key, { enabled: isEnabled, cachedAt: now });
  return isEnabled;
}
