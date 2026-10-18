import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { hasApplyPrivacyPolicy, validateApplyAcademicRank, validateApplyChoices } from '@/app/lib/moyeoApply';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Every response is private, including errors. Submission-gated data must never
// be shared through a CDN or the browser's HTTP cache.
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function databaseError(error: { message: string; code?: string }) {
  switch (error.message) {
    case 'APPLY_UNAUTHENTICATED':
      return json({ error: '로그인이 필요해요. 다시 로그인해주세요.' }, 401);
    case 'APPLY_INVALID_CHOICES':
      return json({ error: '기업을 중복 없이 1지망부터 5지망까지 모두 선택해주세요.' }, 400);
    case 'APPLY_INVALID_ACADEMIC_RANK':
      return json({ error: '석차는 1 이상의 정수로 입력하거나 비워두세요.' }, 400);
    case 'APPLY_INVALID_VISIBILITY':
      return json({ error: '이름 공개 여부를 선택해주세요.' }, 400);
    case 'APPLY_EDIT_LIMIT':
      return json({ error: '수정 2회를 모두 사용했어요. 다른 제출자의 지망은 계속 볼 수 있어요.' }, 403);
    case 'APPLY_CONFIRMED':
      return json({ error: '제출 완료로 확정한 지망은 수정할 수 없어요.' }, 409);
    case 'APPLY_NOT_SUBMITTED':
      return json({ error: '지망을 먼저 저장해주세요.' }, 409);
    case 'APPLY_CONFLICT':
      return json({ error: '다른 창에서 지망이나 공개 설정을 저장했어요. 최신 내용을 불러온 뒤 다시 확인해주세요.' }, 409);
  }
  if (error.code === 'PGRST202' || error.code === '42P01' || error.code === '42883') {
    return json({ error: '모여 어플라이를 준비하고 있어요. 잠시 후 다시 시도해주세요.' }, 503);
  }
  // Do not include submitted choices, tokens, or database details in responses.
  console.error('Moyeo Apply database request failed:', error.code ?? 'unknown');
  return json({ error: '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.' }, 500);
}

export async function GET() {
  try {
    if (!await getSession()) return json({ error: '로그인이 필요해요.' }, 401);

    // Pass the existing signed-in user's JWT, not the service-role client.
    // The RPC derives identity from auth.uid() and gates participant reads itself.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('moyeo_apply_state');
    if (error) return databaseError(error);
    if (!data) return json({ error: '지망 정보를 불러오지 못했어요.' }, 500);
    if (!hasApplyPrivacyPolicy(data)) {
      return json({ error: '개인정보 보호 설정을 적용 중이에요. 잠시 후 다시 시도해주세요.' }, 503);
    }
    return json(data);
  } catch {
    return json({ error: '지망 정보를 불러오지 못했어요. 다시 시도해주세요.' }, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!await getSession()) return json({ error: '로그인이 필요해요.' }, 401);

    const body = await request.json().catch(() => null);
    const validationError = validateApplyChoices(body?.choices);
    if (validationError) return json({ error: validationError }, 400);
    const rankError = validateApplyAcademicRank(body?.academicRank);
    if (rankError) return json({ error: rankError }, 400);
    const expectedEditCount: unknown = body?.expectedEditCount;
    if (expectedEditCount !== null && (
      typeof expectedEditCount !== 'number'
      || !Number.isInteger(expectedEditCount)
      || expectedEditCount < 0
      || expectedEditCount > 2
    )) {
      return json({ error: '최신 지망 정보를 불러온 뒤 다시 저장해주세요.' }, 400);
    }
    const expectedUpdatedAt: unknown = body?.expectedUpdatedAt;
    if (expectedEditCount === null ? expectedUpdatedAt !== null : (
      typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))
    )) {
      return json({ error: '최신 지망 정보를 불러온 뒤 다시 저장해주세요.' }, 400);
    }

    const supabase = await createSupabaseServerClient();
    // The database validates company IDs, locks this user's submission, and
    // persists choices and edit count together in one transaction.
    const { data, error } = await supabase.rpc('moyeo_apply_save', {
      p_choices: body.choices,
      p_expected_edit_count: expectedEditCount,
      p_academic_rank: body.academicRank,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error) return databaseError(error);
    if (!data) return json({ error: '저장 결과를 확인하지 못했어요. 새로고침으로 확인해주세요.' }, 500);
    if (!hasApplyPrivacyPolicy(data)) {
      return json({ error: '개인정보 보호 설정을 적용 중이에요. 잠시 후 다시 시도해주세요.' }, 503);
    }
    return json(data);
  } catch {
    return json({ error: '저장 결과를 확인하지 못했어요. 새로고침 후 다시 확인해주세요.' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await getSession()) return json({ error: '로그인이 필요해요.' }, 401);
    const body = await request.json().catch(() => null);
    if (typeof body?.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      return json({ error: '최신 지망 정보를 불러온 뒤 다시 확정해주세요.' }, 400);
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('moyeo_apply_confirm', {
      p_expected_updated_at: body.expectedUpdatedAt,
    });
    if (error) return databaseError(error);
    if (!data) return json({ error: '확정 결과를 확인하지 못했어요. 새로고침해주세요.' }, 500);
    if (!hasApplyPrivacyPolicy(data)) {
      return json({ error: '개인정보 보호 설정을 적용 중이에요. 잠시 후 다시 시도해주세요.' }, 503);
    }
    return json(data);
  } catch {
    return json({ error: '확정 결과를 확인하지 못했어요. 새로고침 후 다시 확인해주세요.' }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!await getSession()) return json({ error: '로그인이 필요해요.' }, 401);
    const body = await request.json().catch(() => null);
    if (typeof body?.isNamePublic !== 'boolean'
      || typeof body?.expectedUpdatedAt !== 'string'
      || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      return json({ error: '최신 이름 공개 설정을 불러온 뒤 다시 시도해주세요.' }, 400);
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('moyeo_apply_set_name_visibility', {
      p_is_name_public: body.isNamePublic,
      p_expected_updated_at: body.expectedUpdatedAt,
    });
    if (error) return databaseError(error);
    if (!data) return json({ error: '설정 저장 결과를 확인하지 못했어요. 새로고침해주세요.' }, 500);
    if (!hasApplyPrivacyPolicy(data)) {
      return json({ error: '개인정보 보호 설정을 적용 중이에요. 잠시 후 다시 시도해주세요.' }, 503);
    }
    return json(data);
  } catch {
    return json({ error: '설정을 저장하지 못했어요. 새로고침 후 다시 확인해주세요.' }, 500);
  }
}
