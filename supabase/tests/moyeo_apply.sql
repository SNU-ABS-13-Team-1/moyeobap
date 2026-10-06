-- Run after migrations in a disposable/local Supabase database, as postgres:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/moyeo_apply.sql
-- No pgTAP extension required. All fixtures and changes are rolled back.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a6610000-0000-4000-8000-000000000001', 'apply-test-a@example.invalid', '{"full_name":"Apply 테스트 가"}'),
  ('a6610000-0000-4000-8000-000000000002', 'apply-test-b@example.invalid', '{"full_name":"Apply 테스트 나"}');

-- Also supports test databases without the existing auth profile trigger.
insert into public.profiles (id, display_name) values
  ('a6610000-0000-4000-8000-000000000001', 'Apply 테스트 가'),
  ('a6610000-0000-4000-8000-000000000002', 'Apply 테스트 나')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;

do $$
declare
  v_result jsonb;
  v_state jsonb;
  v_saved_at jsonb;
  v_invalid text[];
begin
  -- Calling the authenticated RPC without a user identity is also rejected.
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

  -- Invalid choices must leave the user unsubmitted and consume no edits.
  for v_invalid in select choices from (values
    (array[]::text[]),
    (array['samjong-kpmg', 'samjong-kpmg']),
    (array['samjong-kpmg', null, 'jido-labs']),
    (array['unknown-company']),
    (array['samjong-kpmg', 'national-data-agency', 'anda-asia-ventures', 'car123', 'jido-labs', 'kt-alpha'])
  ) invalid(choices)
  loop
    begin
      perform public.moyeo_apply_save(v_invalid);
      raise exception 'FAIL: invalid choices were accepted';
    exception when raise_exception then
      if sqlerrm <> 'APPLY_INVALID_CHOICES' then raise; end if;
    end;
  end loop;

  v_result := public.moyeo_apply_save(array['samjong-kpmg', 'jido-labs']);
  if v_result#>'{submission,editCount}' <> '0'::jsonb or v_result->'changed' <> 'true'::jsonb then
    raise exception 'FAIL: first submission consumed an edit';
  end if;
  v_state := public.moyeo_apply_state();
  if v_state#>'{submission,choices}' <> '["samjong-kpmg","jido-labs"]'::jsonb
      or jsonb_typeof(v_state->'participants') <> 'array' then
    raise exception 'FAIL: saved submission did not round trip or unlock reads';
  end if;

  -- A different, unsubmitted identity still cannot read the first submission.
  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000002', true);
  v_state := public.moyeo_apply_state();
  if v_state->'participants' <> 'null'::jsonb then
    raise exception 'FAIL: another unsubmitted user can read submissions';
  end if;
  if has_table_privilege(current_user, 'public.moyeo_apply_submissions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'FAIL: direct table access granted';
  end if;
  begin
    perform choices from public.moyeo_apply_submissions;
    raise exception 'FAIL: direct table read succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.moyeo_apply_submissions set edit_count = 0;
    raise exception 'FAIL: direct edit counter reset succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.moyeo_apply_submissions;
    raise exception 'FAIL: direct deletion succeeded';
  exception when insufficient_privilege then null;
  end;

  perform public.moyeo_apply_save(array['car123']);
  v_state := public.moyeo_apply_state();
  if not exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p->>'displayName' = 'Apply 테스트 가' and p->>'isMe' = 'false'
  ) or not exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p->>'displayName' = 'Apply 테스트 나' and p->>'isMe' = 'true'
  ) then
    raise exception 'FAIL: submitter cannot see other submitter or identify own row';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_state->'participants') p
    where p - 'displayName' - 'choices' - 'isMe' <> '{}'::jsonb
  ) then
    raise exception 'FAIL: participant response leaks private fields';
  end if;

  perform set_config('request.jwt.claim.sub', 'a6610000-0000-4000-8000-000000000001', true);
  v_saved_at := public.moyeo_apply_state()#>'{submission,updatedAt}';
  v_result := public.moyeo_apply_save(array['samjong-kpmg', 'jido-labs'], 0);
  if v_result->'changed' <> 'false'::jsonb
      or v_result#>'{submission,updatedAt}' <> v_saved_at
      or v_result#>'{submission,editCount}' <> '0'::jsonb then
    raise exception 'FAIL: unchanged save consumed an edit or changed its timestamp';
  end if;

  v_result := public.moyeo_apply_save(array['kt-alpha', 'car123'], 0);
  if v_result#>'{submission,editCount}' <> '1'::jsonb then
    raise exception 'FAIL: changing multiple ranks did not count as one edit';
  end if;
  begin
    perform public.moyeo_apply_save(array['jido-labs'], 0);
    raise exception 'FAIL: stale save was accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;
  v_result := public.moyeo_apply_save(array['jido-labs'], 1);
  if v_result#>'{submission,editCount}' <> '2'::jsonb then
    raise exception 'FAIL: second edit count incorrect';
  end if;
  begin
    perform public.moyeo_apply_save(array['samjong-kpmg'], 2);
    raise exception 'FAIL: third edit was accepted';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_EDIT_LIMIT' then raise; end if;
  end;

  -- A lost-response retry is free even after reaching the cap.
  v_result := public.moyeo_apply_save(array['jido-labs'], 1);
  v_state := public.moyeo_apply_state();
  if v_result->'changed' <> 'false'::jsonb
      or v_state#>'{submission,editCount}' <> '2'::jsonb
      or v_state#>'{submission,choices}' <> '["jido-labs"]'::jsonb
      or jsonb_typeof(v_state->'participants') <> 'array' then
    raise exception 'FAIL: locked submitter lost saved data or read access';
  end if;
  raise notice 'PASS: persistence, submitter-only reads, private fields, direct access denial, and two-edit limit';
end;
$$;

reset role;
do $$
begin
  if has_function_privilege('anon', 'public.moyeo_apply_state()', 'EXECUTE')
    or has_function_privilege('anon', 'public.moyeo_apply_save(text[],integer)', 'EXECUTE') then
    raise exception 'FAIL: anonymous RPC access granted';
  end if;
end;
$$;

rollback;
