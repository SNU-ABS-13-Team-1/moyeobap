import type { SupabaseClient } from '@supabase/supabase-js';

/** 팟 목록·통계가 공통으로 쓰는 프로젝션. 계좌번호(bank_account)는 내려받지 않습니다. */
export const POT_ROW_SELECT =
  '*, pot_participants(user_id, user_name, user_initial, is_paid, order_memo, joined_at)';

/** PostgREST가 한 번에 돌려주는 기본 상한(프로젝트 설정 max-rows). */
export const POT_PAGE_SIZE = 1000;

/**
 * 통계 집계용: 팟 전체를 페이지 단위로 끝까지 읽습니다.
 *
 * listPots()는 Egress 방어로 최근 60개만 읽으므로, 캠퍼스 통계처럼 누적치가
 * 필요한 곳은 이 함수를 씁니다. 호출 빈도는 상위에서 캐시로 제한합니다.
 */
export async function fetchAllPotRows(db: SupabaseClient, pageSize = POT_PAGE_SIZE) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('pots')
      .select(POT_ROW_SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`pots stats query failed: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
