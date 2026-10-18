-- Disposable DB only. All fixture data and mutations roll back.
begin;
insert into auth.users (id)
select ('d6610000-0000-4000-8000-00000000000' || n)::uuid from generate_series(1,4) n;
insert into public.profiles(id, display_name) values
 ('d6610000-0000-4000-8000-000000000001', '비공개실명가'),
 ('d6610000-0000-4000-8000-000000000002', '비공개실명나'),
 ('d6610000-0000-4000-8000-000000000003', '미정사용자')
on conflict (id) do update set display_name = excluded.display_name;
insert into public.moyeo_apply_submissions(user_id, choices, academic_rank, edit_count) values
 ('d6610000-0000-4000-8000-000000000001', array['car123','kt-alpha','mnb','aurora-world','samjong-kpmg'], 12, 2),
 ('d6610000-0000-4000-8000-000000000002', array['mnb','kt-alpha','car123','aurora-world','samjong-kpmg'], null, 0),
 ('d6610000-0000-4000-8000-000000000003', array['kt-alpha'], 1, 2);
set local role authenticated;
do $$
declare
  v_state jsonb;
  v_result jsonb;
  v_before timestamptz;
  v_confirmed_at text;
  v_choices text[] := array['car123','kt-alpha','mnb','aurora-world','samjong-kpmg'];
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.moyeo_apply_set_name_visibility(true, now());
    raise exception 'FAIL: anonymous visibility change';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_UNAUTHENTICATED' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000004', true);
  begin
    perform public.moyeo_apply_set_name_visibility(true, now());
    raise exception 'FAIL: unsubmitted visibility change';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_NOT_SUBMITTED' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000003', true);
  v_state := public.moyeo_apply_state();
  if v_state->'participants' <> 'null'::jsonb
    or v_state#>'{submission,requiresResubmission}' <> 'true'::jsonb then
    raise exception 'FAIL: incomplete ranked user can read participants';
  end if;
  v_before := (v_state#>>'{submission,updatedAt}')::timestamptz;
  begin
    perform public.moyeo_apply_save(v_choices, 2, 1, v_before - interval '1 second');
    raise exception 'FAIL: stale re-entry allowed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000001', true);
  v_state := public.moyeo_apply_state();
  if jsonb_array_length(v_state->'participants') <> 2 or exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p->>'displayName' <> '이름 비공개' or p ? 'user_id' or p ? 'userId'
      or p->>'academicRank' = '1'
  ) then raise exception 'FAIL: default names or incomplete participants leaked'; end if;
  if v_state#>'{submission,isNamePublic}' <> 'false'::jsonb then
    raise exception 'FAIL: name public by default';
  end if;
  -- Even at the edit cap, confirmation and visibility are independent.
  v_result := public.moyeo_apply_confirm((v_state#>>'{submission,updatedAt}')::timestamptz);
  v_confirmed_at := v_result#>>'{submission,confirmedAt}';
  v_before := (v_result#>>'{submission,updatedAt}')::timestamptz;
  v_result := public.moyeo_apply_set_name_visibility(true, v_before);
  if v_result#>'{submission,isNamePublic}' <> 'true'::jsonb
    or v_result#>'{submission,editCount}' <> '2'::jsonb
    or v_result#>>'{submission,confirmedAt}' <> v_confirmed_at
    or v_result#>'{submission,choices}' <> to_jsonb(v_choices)
    or v_result#>'{submission,academicRank}' <> '12'::jsonb then
    raise exception 'FAIL: visibility altered locked submission';
  end if;
  if public.moyeo_apply_set_name_visibility(true, v_before)->'changed' <> 'false'::jsonb then
    raise exception 'FAIL: visibility retry not idempotent';
  end if;
  begin
    perform public.moyeo_apply_set_name_visibility(false, v_before);
    raise exception 'FAIL: stale visibility change';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;
  begin
    update public.moyeo_apply_submissions set is_name_public = true;
    raise exception 'FAIL: direct visibility update permitted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000002', true);
  v_state := public.moyeo_apply_state();
  if not exists (select 1 from jsonb_array_elements(v_state->'participants') p
    where p->>'displayName' = '비공개실명가') or exists (
    select 1 from jsonb_array_elements(v_state->'participants') p where p ? 'academicRank'
  ) then raise exception 'FAIL: opted-in name not visible or rank privacy broken'; end if;
  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000001', true);
  perform public.moyeo_apply_set_name_visibility(false, (v_result#>>'{submission,updatedAt}')::timestamptz);
  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000002', true);
  if exists (select 1 from jsonb_array_elements(public.moyeo_apply_state()->'participants') p
    where p->>'displayName' <> '이름 비공개') then
    raise exception 'FAIL: name remained visible after opt-out';
  end if;

  perform set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000003', true);
  v_before := (public.moyeo_apply_state()#>>'{submission,updatedAt}')::timestamptz;
  v_result := public.moyeo_apply_save(v_choices, 2, 1, v_before);
  if v_result#>'{submission,editCount}' <> '0'::jsonb
    or v_result#>'{submission,requiresResubmission}' <> 'false'::jsonb
    or v_result#>'{submission,isNamePublic}' <> 'false'::jsonb
    or jsonb_array_length(public.moyeo_apply_state()->'participants') <> 3 then
    raise exception 'FAIL: free re-entry at cap did not restore participation';
  end if;
  if public.moyeo_apply_save(v_choices, 2, 1, v_before)->'changed' <> 'false'::jsonb then
    raise exception 'FAIL: re-entry retry consumed an edit';
  end if;
  v_result := public.moyeo_apply_save(v_choices, 0, 2, (v_result#>>'{submission,updatedAt}')::timestamptz);
  if v_result#>'{submission,editCount}' <> '1'::jsonb then
    raise exception 'FAIL: second save incorrectly treated as re-entry';
  end if;
  if has_function_privilege('anon', 'public.moyeo_apply_set_name_visibility(boolean,timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: anonymous RPC execute granted';
  end if;
end;
$$;
-- Hidden profile name changes must not change either values or array order.
select set_config('request.jwt.claim.sub', 'd6610000-0000-4000-8000-000000000002', true);
select set_config('test.apply_participants', (public.moyeo_apply_state()->'participants')::text, true);
reset role;
update public.profiles set display_name = case
 when id = 'd6610000-0000-4000-8000-000000000001' then 'ZZZ'
 else 'AAA' end where id in ('d6610000-0000-4000-8000-000000000001', 'd6610000-0000-4000-8000-000000000002');
-- Swap two non-viewer user IDs without changing submissions' private sort keys.
-- A caller who knows public IDs elsewhere must not learn this mapping from order.
update public.moyeo_apply_submissions set user_id = 'd6610000-0000-4000-8000-000000000004'
where user_id = 'd6610000-0000-4000-8000-000000000001';
update public.moyeo_apply_submissions set user_id = 'd6610000-0000-4000-8000-000000000001'
where user_id = 'd6610000-0000-4000-8000-000000000003';
update public.moyeo_apply_submissions set user_id = 'd6610000-0000-4000-8000-000000000003'
where user_id = 'd6610000-0000-4000-8000-000000000004';
set local role authenticated;
do $$
begin
  if public.moyeo_apply_state()->'participants' <> current_setting('test.apply_participants')::jsonb then
    raise exception 'FAIL: hidden names or user IDs affected list ordering';
  end if;
end;
$$;
rollback;
