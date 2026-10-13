-- Run after migrations in a disposable/local Supabase database, as postgres:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/moyeo_apply.sql
-- No pgTAP extension required. All fixtures and changes are rolled back.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('a6610000-0000-4000-8000-000000000001', 'apply-test-a@example.invalid', '{"full_name":"Apply 테스트 가"}'),
  ('a6610000-0000-4000-8000-000000000002', 'apply-test-b@example.invalid', '{"full_name":"Apply 테스트 나"}'),
  ('a6610000-0000-4000-8000-000000000003', 'apply-test-c@example.invalid', '{"full_name":"Apply 테스트 다"}');
insert into public.profiles (id, display_name) values
  ('a6610000-0000-4000-8000-000000000001', 'Apply 테스트 가'),
  ('a6610000-0000-4000-8000-000000000002', 'Apply 테스트 나'),
  ('a6610000-0000-4000-8000-000000000003', 'Apply 테스트 다')
on conflict (id) do update set display_name = excluded.display_name;
-- Legacy incomplete submissions remain readable, but cannot be saved as-is.
insert into public.moyeo_apply_submissions (user_id, choices) values
  ('a6610000-0000-4000-8000-000000000003', array['car123']);

set local role authenticated;
do $$
declare
  v_choices text[] := array['samjong-kpmg', 'jido-labs', 'car123', 'kt-alpha', 'mnb'];
  v_result jsonb;
  v_state jsonb;
  v_saved_at timestamptz;
  v_invalid text[];
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.moyeo_apply_state();
    raise exception 'FAIL: missing identity was accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_UNAUTHENTICATED' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000001', true);
  v_state := public.moyeo_apply_state();
  if v_state->'submission' <> 'null'::jsonb or v_state->'participants' <> 'null'::jsonb then
    raise exception 'FAIL: unsubmitted user can read submissions';
  end if;
  for v_invalid in select choices from (values
    (array[]::text[]), (array['samjong-kpmg']),
    (array['samjong-kpmg', 'jido-labs', 'car123', 'kt-alpha']),
    (array['samjong-kpmg', 'samjong-kpmg', 'car123', 'kt-alpha', 'mnb']),
    (array['samjong-kpmg', null, 'car123', 'kt-alpha', 'mnb']),
    (array['samjong-kpmg', 'unknown-company', 'car123', 'kt-alpha', 'mnb']),
    (v_choices || 'aurora-world'::text)
  ) invalid(choices) loop
    begin
      perform public.moyeo_apply_save(v_invalid);
      raise exception 'FAIL: invalid choices were accepted';
    exception when raise_exception then
      if sqlerrm <> 'APPLY_INVALID_CHOICES' then raise; end if;
    end;
  end loop;
  begin
    perform public.moyeo_apply_save(v_choices, null, 0);
    raise exception 'FAIL: invalid academic rank was accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_INVALID_ACADEMIC_RANK' then raise; end if;
  end;
  v_result := public.moyeo_apply_save(v_choices, null, 12);
  if v_result#>'{submission,editCount}' <> '0'::jsonb
    or v_result#>'{submission,academicRank}' <> '12'::jsonb
    or v_result#>'{submission,choices}' <> to_jsonb(v_choices) then
    raise exception 'FAIL: initial ranked submission did not round trip';
  end if;

  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000002', true);
  if public.moyeo_apply_state()->'participants' <> 'null'::jsonb then
    raise exception 'FAIL: another unsubmitted user can read submissions';
  end if;
  perform public.moyeo_apply_save(v_choices, null, null);
  v_state := public.moyeo_apply_state();
  if jsonb_typeof(v_state->'participants') <> 'array' or exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p - 'displayName' - 'choices' - 'isMe' <> '{}'::jsonb
  ) then
    raise exception 'FAIL: unranked participant can read rank or private fields';
  end if;
  if has_table_privilege(current_user, 'public.moyeo_apply_submissions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'FAIL: direct table access granted';
  end if;
  begin
    perform academic_rank from public.moyeo_apply_submissions;
    raise exception 'FAIL: direct rank read succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.moyeo_apply_submissions set edit_count = 0;
    raise exception 'FAIL: direct counter reset succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.moyeo_apply_submissions;
    raise exception 'FAIL: direct deletion succeeded';
  exception when insufficient_privilege then null;
  end;

  v_saved_at := (v_state#>>'{submission,updatedAt}')::timestamptz;
  v_result := public.moyeo_apply_save(v_choices, 0, 7, v_saved_at);
  v_state := public.moyeo_apply_state();
  if v_result#>'{submission,editCount}' <> '1'::jsonb or not exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p->>'displayName' = 'Apply 테스트 가' and p->>'academicRank' = '12'
  ) or not exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p->>'isMe' = 'true' and p->>'academicRank' = '7'
  ) then
    raise exception 'FAIL: adding rank did not consume one edit and unlock other ranks';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p - 'displayName' - 'choices' - 'isMe' - 'academicRank' <> '{}'::jsonb
  ) then
    raise exception 'FAIL: ranked participant sees private bookkeeping';
  end if;
  begin
    perform public.moyeo_apply_save(v_choices, 1, 8, v_saved_at);
    raise exception 'FAIL: stale timestamp was accepted despite matching edit count';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;
  v_saved_at := (v_state#>>'{submission,updatedAt}')::timestamptz;
  begin
    perform public.moyeo_apply_save(v_choices, 0, 8, v_saved_at);
    raise exception 'FAIL: stale edit count was accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;
  v_result := public.moyeo_apply_save(v_choices, 1, 7, v_saved_at);
  if v_result->'changed' <> 'false'::jsonb
    or (v_result#>>'{submission,updatedAt}')::timestamptz <> v_saved_at
    or v_result#>'{submission,editCount}' <> '1'::jsonb then
    raise exception 'FAIL: no-op consumed edit or changed timestamp';
  end if;
  v_result := public.moyeo_apply_save(v_choices, 1, null, v_saved_at);
  v_state := public.moyeo_apply_state();
  if v_result#>'{submission,editCount}' <> '2'::jsonb or exists (
    select 1 from jsonb_array_elements(v_state->'participants') p where p ? 'academicRank'
  ) then
    raise exception 'FAIL: removing rank did not consume one edit and revoke rank access';
  end if;
  -- Other rank sharers also stop seeing the removed rank.
  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000001', true);
  if exists (
    select 1 from jsonb_array_elements(public.moyeo_apply_state()->'participants') p
    where p->>'displayName' = 'Apply 테스트 나' and p->'academicRank' <> 'null'::jsonb
  ) then raise exception 'FAIL: removed rank still exposed to others'; end if;
  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000002', true);
  begin
    perform public.moyeo_apply_save(v_choices, 2, 9, (v_state#>>'{submission,updatedAt}')::timestamptz);
    raise exception 'FAIL: third edit was accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_EDIT_LIMIT' then raise; end if;
  end;
  -- Lost-response retry remains free at cap.
  v_result := public.moyeo_apply_save(v_choices, 1, null, v_saved_at);
  if v_result->'changed' <> 'false'::jsonb or v_result#>'{submission,editCount}' <> '2'::jsonb then
    raise exception 'FAIL: retry at cap not idempotent';
  end if;

  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000003', true);
  v_state := public.moyeo_apply_state();
  if v_state#>'{submission,choices}' <> '["car123"]'::jsonb then
    raise exception 'FAIL: legacy choices unreadable';
  end if;
  begin
    perform public.moyeo_apply_save(array['car123'], 0, 3, (v_state#>>'{submission,updatedAt}')::timestamptz);
    raise exception 'FAIL: legacy incomplete save accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_INVALID_CHOICES' then raise; end if;
  end;
  v_result := public.moyeo_apply_save(v_choices, 0, 3, (v_state#>>'{submission,updatedAt}')::timestamptz);
  if v_result#>'{submission,editCount}' <> '1'::jsonb then
    raise exception 'FAIL: completing legacy submission did not count as one edit';
  end if;
  raise notice 'PASS: five choices, legacy reads, mutual rank sharing, revocation, privacy, concurrency and two-edit limit';
end;
$$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.moyeo_apply_state()', 'EXECUTE')
    or has_function_privilege('anon', 'public.moyeo_apply_save(text[],integer,integer,timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: anonymous RPC access granted';
  end if;
  if to_regprocedure('public.moyeo_apply_save(text[],integer)') is not null then
    raise exception 'FAIL: legacy write signature still available';
  end if;
end;
$$;
rollback;
