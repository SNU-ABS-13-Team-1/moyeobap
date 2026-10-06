-- 모여 어플라이: 기업 목록은 이 테이블에서만 관리합니다.
-- 공개 REST 테이블 접근 대신 auth.uid()를 확인하는 두 RPC만 사용합니다.
create table public.moyeo_apply_companies (
  id text primary key,
  name text not null unique,
  sort_order integer not null unique
);

insert into public.moyeo_apply_companies (id, name, sort_order) values
  ('samjong-kpmg', '삼정KPMG', 1),
  ('national-data-agency', '국가데이터처', 2),
  ('anda-asia-ventures', '안다아시아벤처스', 3),
  ('donghun-investment', '동훈인베스트먼트', 4),
  ('car123', '카일이삼제스퍼(CAR123)', 5),
  ('aurora-world', '오로라월드', 6),
  ('eugene-hanil', '유진한일합섬', 7),
  ('jido-labs', 'Jido Labs', 8),
  ('kt-alpha', 'KT알파', 9),
  ('cosrigger', '코스리거', 10),
  ('mnb', '엠엔비', 11),
  ('kyobo-securities', '교보증권', 12);

create table public.moyeo_apply_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Only filled ranks are stored; missing trailing ranks mean "미정".
  choices text[] not null check (
    array_ndims(choices) = 1
    and array_lower(choices, 1) = 1
    and cardinality(choices) between 1 and 5
    and array_position(choices, null) is null
  ),
  edit_count integer not null default 0 check (edit_count between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.moyeo_apply_companies enable row level security;
alter table public.moyeo_apply_submissions enable row level security;

-- No client-facing policies or table privileges: even a direct Supabase request
-- cannot read private bookkeeping, reset the counter, delete, or edit another user.
revoke all on public.moyeo_apply_companies from public, anon, authenticated;
revoke all on public.moyeo_apply_submissions from public, anon, authenticated;

create function public.moyeo_apply_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.moyeo_apply_submissions%rowtype;
  v_own jsonb := null;
  v_participants jsonb := null;
  v_companies jsonb;
begin
  if v_user_id is null then
    raise exception 'APPLY_UNAUTHENTICATED';
  end if;

  select * into v_submission
  from public.moyeo_apply_submissions where user_id = v_user_id;

  if found then
    v_own := jsonb_build_object(
      'choices', v_submission.choices,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at
    );

    -- Read other people only after a persisted submission has been found.
    -- Profile names are current; no email fallback or submission history is exposed.
    select coalesce(jsonb_agg(jsonb_build_object(
      'displayName', coalesce(p.display_name, '사용자'),
      'choices', s.choices,
      'isMe', s.user_id = v_user_id
    ) order by coalesce(p.display_name, '사용자'), s.user_id), '[]'::jsonb)
    into v_participants
    from public.moyeo_apply_submissions s
    left join public.profiles p on p.id = s.user_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name
  ) order by sort_order), '[]'::jsonb)
  into v_companies from public.moyeo_apply_companies;

  return jsonb_build_object(
    'companies', v_companies,
    'submission', v_own,
    'participants', v_participants
  );
end;
$$;

create function public.moyeo_apply_save(
  p_choices text[],
  p_expected_edit_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.moyeo_apply_submissions%rowtype;
  v_changed boolean := true;
begin
  if v_user_id is null then
    raise exception 'APPLY_UNAUTHENTICATED';
  end if;

  if p_choices is null
    or array_ndims(p_choices) is distinct from 1
    or array_lower(p_choices, 1) is distinct from 1
    or cardinality(p_choices) not between 1 and 5
  then
    raise exception 'APPLY_INVALID_CHOICES';
  end if;

  if array_position(p_choices, null) is not null
    or (select count(distinct choice) from unnest(p_choices) as input(choice))
      <> cardinality(p_choices)
    or exists (
      select 1 from unnest(p_choices) as input(choice)
      where not exists (
        select 1 from public.moyeo_apply_companies c where c.id = input.choice
      )
    )
  then
    raise exception 'APPLY_INVALID_CHOICES';
  end if;

  -- Serialize by user even before the first row exists. The read, save, and
  -- counter increment share this transaction; concurrent requests cannot reset
  -- or exceed the limit. Hash collisions only cause harmless extra waiting.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 20261006));

  select * into v_submission
  from public.moyeo_apply_submissions where user_id = v_user_id
  for update;

  if not found then
    if p_expected_edit_count is not null then
      raise exception 'APPLY_CONFLICT';
    end if;
    insert into public.moyeo_apply_submissions (user_id, choices)
    values (v_user_id, p_choices)
    returning * into v_submission;
  elsif v_submission.choices = p_choices then
    -- A retry after a lost response and an unchanged save are free, even at cap.
    v_changed := false;
  else
    if v_submission.edit_count >= 2 then
      raise exception 'APPLY_EDIT_LIMIT';
    end if;
    if p_expected_edit_count is distinct from v_submission.edit_count then
      raise exception 'APPLY_CONFLICT';
    end if;
    update public.moyeo_apply_submissions
    set choices = p_choices,
        edit_count = edit_count + 1,
        updated_at = clock_timestamp()
    where user_id = v_user_id
    returning * into v_submission;
  end if;

  return jsonb_build_object(
    'submission', jsonb_build_object(
      'choices', v_submission.choices,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at
    ),
    'changed', v_changed
  );
end;
$$;

revoke all on function public.moyeo_apply_state() from public, anon, authenticated;
revoke all on function public.moyeo_apply_save(text[], integer) from public, anon, authenticated;
grant execute on function public.moyeo_apply_state() to authenticated;
grant execute on function public.moyeo_apply_save(text[], integer) to authenticated;
