import { getSupabase } from "./supabase";

/**
 * DB의 app_flags 테이블을 조회합니다. 테이블이 아직 없거나(마이그레이션
 * 미실행) 조회에 실패하면 항상 false를 반환합니다(fail-closed) — 실서버에
 * 실수로 새 기능이 노출되는 쪽보다, 테스트서버에서 깜빡 안 켜지는 쪽이
 * 훨씬 안전하기 때문입니다.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("app_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle<{ enabled: boolean }>();

  if (error || !data) return false;
  return data.enabled === true;
}
