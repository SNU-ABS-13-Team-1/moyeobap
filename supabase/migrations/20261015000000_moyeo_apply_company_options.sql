-- Preserve historical choices; retired options cannot be selected in new saves.
begin;

alter table public.moyeo_apply_companies
  add column is_active boolean not null default true;

update public.moyeo_apply_companies
set is_active = false
where id in ('jido-labs', 'national-data-agency');

-- Move through negative values to avoid the immediate unique sort_order constraint.
update public.moyeo_apply_companies set sort_order = -sort_order;
update public.moyeo_apply_companies set sort_order = -sort_order * 10;

insert into public.moyeo_apply_companies (id, name, sort_order) values
  ('national-data-agency-daejeon', '국가데이터처(대전)', 21),
  ('national-data-agency-seoul', '국가데이터처(서울)', 22),
  ('national-data-agency-any', '국가데이터처(무차별)', 23);

create or replace function public.moyeo_apply_state()
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
      'academicRank', v_submission.academic_rank,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at
    );

    -- Read other people only after a persisted submission has been found.
    -- Profile names are current; no email fallback or submission history is exposed.
    select coalesce(jsonb_agg(jsonb_build_object(
      'displayName', coalesce(p.display_name, '사용자'),
      'choices', s.choices,
      'isMe', s.user_id = v_user_id
    ) || case when v_submission.academic_rank is not null
      then jsonb_build_object('academicRank', s.academic_rank)
      else '{}'::jsonb end order by coalesce(p.display_name, '사용자'), s.user_id), '[]'::jsonb)
    into v_participants
    from public.moyeo_apply_submissions s
    left join public.profiles p on p.id = s.user_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'isActive', is_active
  ) order by sort_order), '[]'::jsonb)
  into v_companies from public.moyeo_apply_companies;

  return jsonb_build_object(
    'companies', v_companies,
    'submission', v_own,
    'participants', v_participants
  );
end;
$$;

create or replace function public.moyeo_apply_save(
  p_choices text[],
  p_expected_edit_count integer default null,
  p_academic_rank integer default null,
  p_expected_updated_at timestamptz default null
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
    or cardinality(p_choices) <> 5
  then
    raise exception 'APPLY_INVALID_CHOICES';
  end if;

  if array_position(p_choices, null) is not null
    or (select count(distinct choice) from unnest(p_choices) as input(choice))
      <> cardinality(p_choices)
    or exists (
      select 1 from unnest(p_choices) as input(choice)
      where not exists (
        select 1 from public.moyeo_apply_companies c where c.id = input.choice and c.is_active
      )
    )
  then
    raise exception 'APPLY_INVALID_CHOICES';
  end if;

  if p_academic_rank is not null and p_academic_rank < 1 then
    raise exception 'APPLY_INVALID_ACADEMIC_RANK';
  end if;

  -- Serialize by user even before the first row exists. The read, save, and
  -- counter increment share this transaction; concurrent requests cannot reset
  -- or exceed the limit. Hash collisions only cause harmless extra waiting.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 20261006));

  select * into v_submission
  from public.moyeo_apply_submissions where user_id = v_user_id
  for update;

  if not found then
    if p_expected_edit_count is not null or p_expected_updated_at is not null then
      raise exception 'APPLY_CONFLICT';
    end if;
    insert into public.moyeo_apply_submissions (user_id, choices, academic_rank)
    values (v_user_id, p_choices, p_academic_rank)
    returning * into v_submission;
  elsif v_submission.choices = p_choices
    and v_submission.academic_rank is not distinct from p_academic_rank then
    -- A retry after a lost response and an unchanged save are free, even at cap.
    v_changed := false;
  else
    if v_submission.edit_count >= 2 then
      raise exception 'APPLY_EDIT_LIMIT';
    end if;
    if p_expected_edit_count is distinct from v_submission.edit_count
      or p_expected_updated_at is distinct from v_submission.updated_at then
      raise exception 'APPLY_CONFLICT';
    end if;
    update public.moyeo_apply_submissions
    set choices = p_choices,
        academic_rank = p_academic_rank,
        edit_count = edit_count + 1,
        updated_at = clock_timestamp()
    where user_id = v_user_id
    returning * into v_submission;
  end if;

  return jsonb_build_object(
    'submission', jsonb_build_object(
      'choices', v_submission.choices,
      'academicRank', v_submission.academic_rank,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at
    ),
    'changed', v_changed
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
