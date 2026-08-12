import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 1000) : '';
  const pagePath = typeof body?.pagePath === 'string' && body.pagePath.startsWith('/')
    ? body.pagePath.slice(0, 200)
    : null;

  if (content.length < 5) {
    return NextResponse.json({ error: '피드백을 5자 이상 입력해주세요.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    content,
    page_path: pagePath,
  });

  if (error) {
    return NextResponse.json(
      { error: '피드백을 저장하지 못했어요. 데이터베이스 마이그레이션을 확인해주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
