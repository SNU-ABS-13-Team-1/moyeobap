-- Incomplete submissions must re-enter all five choices; names are opt-in.
begin;

alter table public.moyeo_apply_submissions
  add column is_name_public boolean not null default false,
  -- Private ordering must not correlate with IDs exposed by unrelated features.
  add column private_sort_key uuid not null default gen_random_uuid();

-- Keep legacy choices/ranks for the owner; access is revoked by state() below.
-- Bump revisions so forms opened before this policy change cannot silently save.
update public.moyeo_apply_submissions set updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond');

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
      'updatedAt', v_submission.updated_at,
      'confirmedAt', v_submission.confirmed_at,
      'isNamePublic', v_submission.is_name_public,
      'requiresResubmission', cardinality(v_submission.choices) < 5
    );

    -- An incomplete legacy submission grants no access and is not listed.
    if cardinality(v_submission.choices) = 5 then
      -- Mask in the DB, including sorting: never expose hidden names or identity IDs.
      select coalesce(jsonb_agg(jsonb_build_object(
        'displayName', case when s.is_name_public then coalesce(p.display_name, '사용자') else '이름 비공개' end,
        'choices', s.choices,
        'isMe', s.user_id = v_user_id,
        'isConfirmed', s.confirmed_at is not null
      ) || case when v_submission.academic_rank is not null
        then jsonb_build_object('academicRank', s.academic_rank)
        else '{}'::jsonb end order by case when s.is_name_public then coalesce(p.display_name, '사용자') else '이름 비공개' end, s.private_sort_key), '[]'::jsonb)
      into v_participants
      from public.moyeo_apply_submissions s
      left join public.profiles p on p.id = s.user_id
      where cardinality(s.choices) = 5;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'isActive', is_active
  ) order by sort_order), '[]'::jsonb)
  into v_companies from public.moyeo_apply_companies;

  return jsonb_build_object(
    'privacyVersion', 1,
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
    if v_submission.confirmed_at is not null then
      raise exception 'APPLY_CONFIRMED';
    end if;
    if cardinality(v_submission.choices) = 5 and v_submission.edit_count >= 2 then
      raise exception 'APPLY_EDIT_LIMIT';
    end if;
    if p_expected_edit_count is distinct from v_submission.edit_count
      or p_expected_updated_at is distinct from v_submission.updated_at then
      raise exception 'APPLY_CONFLICT';
    end if;
    update public.moyeo_apply_submissions
    set choices = p_choices,
        academic_rank = p_academic_rank,
        -- A legacy re-entry is a fresh participation, even at the old edit cap.
        edit_count = case when cardinality(v_submission.choices) < 5 then 0 else edit_count + 1 end,
        updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')
    where user_id = v_user_id
    returning * into v_submission;
  end if;

  return jsonb_build_object(
    'privacyVersion', 1,
    'submission', jsonb_build_object(
      'choices', v_submission.choices,
      'academicRank', v_submission.academic_rank,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at,
      'confirmedAt', v_submission.confirmed_at,
      'isNamePublic', v_submission.is_name_public,
      'requiresResubmission', cardinality(v_submission.choices) < 5
    ),
    'changed', v_changed
  );
end;
$$;

create or replace function public.moyeo_apply_confirm(p_expected_updated_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.moyeo_apply_submissions%rowtype;
  v_changed boolean := false;
begin
  if v_user_id is null then
    raise exception 'APPLY_UNAUTHENTICATED';
  end if;

  -- Use the same lock as save so confirmation and edits cannot race.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 20261006));
  select * into v_submission
  from public.moyeo_apply_submissions where user_id = v_user_id
  for update;
  if not found then
    raise exception 'APPLY_NOT_SUBMITTED';
  end if;

  -- A lost-response retry is safe, even with the pre-confirmation revision.
  if v_submission.confirmed_at is null then
    if p_expected_updated_at is distinct from v_submission.updated_at then
      raise exception 'APPLY_CONFLICT';
    end if;
    if cardinality(v_submission.choices) <> 5
      or (select count(distinct choice) from unnest(v_submission.choices) as input(choice)) <> 5
      or exists (
        select 1 from unnest(v_submission.choices) as input(choice)
        where not exists (
          select 1 from public.moyeo_apply_companies c where c.id = input.choice and c.is_active
        )
      )
    then
      raise exception 'APPLY_INVALID_CHOICES';
    end if;

    update public.moyeo_apply_submissions
    set confirmed_at = clock_timestamp(), updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')
    where user_id = v_user_id
    returning * into v_submission;
    v_changed := true;
  end if;

  return jsonb_build_object(
    'privacyVersion', 1,
    'submission', jsonb_build_object(
      'choices', v_submission.choices,
      'academicRank', v_submission.academic_rank,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at,
      'confirmedAt', v_submission.confirmed_at,
      'isNamePublic', v_submission.is_name_public,
      'requiresResubmission', cardinality(v_submission.choices) < 5
    ),
    'changed', v_changed
  );
end;
$$;

revoke all on function public.moyeo_apply_confirm(timestamptz) from public, anon, authenticated;
grant execute on function public.moyeo_apply_confirm(timestamptz) to authenticated;

-- Name visibility is independent of preference edits and final confirmation.
create function public.moyeo_apply_set_name_visibility(
  p_is_name_public boolean,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.moyeo_apply_submissions%rowtype;
  v_changed boolean := false;
begin
  if v_user_id is null then raise exception 'APPLY_UNAUTHENTICATED'; end if;
  if p_is_name_public is null then raise exception 'APPLY_INVALID_VISIBILITY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 20261006));
  select * into v_submission from public.moyeo_apply_submissions
  where user_id = v_user_id for update;
  if not found then raise exception 'APPLY_NOT_SUBMITTED'; end if;

  if v_submission.is_name_public is distinct from p_is_name_public then
    if p_expected_updated_at is distinct from v_submission.updated_at then
      raise exception 'APPLY_CONFLICT';
    end if;
    update public.moyeo_apply_submissions
    set is_name_public = p_is_name_public, updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')
    where user_id = v_user_id returning * into v_submission;
    v_changed := true;
  end if;
  return jsonb_build_object(
    'privacyVersion', 1,
    'submission', jsonb_build_object(
      'choices', v_submission.choices,
      'academicRank', v_submission.academic_rank,
      'editCount', v_submission.edit_count,
      'updatedAt', v_submission.updated_at,
      'confirmedAt', v_submission.confirmed_at,
      'isNamePublic', v_submission.is_name_public,
      'requiresResubmission', cardinality(v_submission.choices) < 5
    ),
    'changed', v_changed
  );
end;
$$;

revoke all on function public.moyeo_apply_set_name_visibility(boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.moyeo_apply_set_name_visibility(boolean, timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
