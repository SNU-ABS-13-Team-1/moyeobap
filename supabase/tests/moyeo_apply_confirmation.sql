-- Run after all Apply migrations in a disposable DB. Never uses real submissions.
begin;
insert into auth.users (id)
select ('c6610000-0000-4000-8000-00000000000' || n)::uuid from generate_series(1,5) n;
insert into public.moyeo_apply_submissions (user_id, choices, academic_rank, edit_count)
values
  ('c6610000-0000-4000-8000-000000000001', array['samjong-kpmg','car123','kt-alpha','mnb','aurora-world'], 12, 2),
  ('c6610000-0000-4000-8000-000000000002', array['samjong-kpmg','car123','kt-alpha','mnb','aurora-world'], null, 0),
  ('c6610000-0000-4000-8000-000000000003', array['car123'], null, 0),
  ('c6610000-0000-4000-8000-000000000004', array['jido-labs','car123','kt-alpha','mnb','aurora-world'], null, 0);
set local role authenticated;
do $$
declare
  v_state jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_before timestamptz;
  v_choices text[] := array['samjong-kpmg','car123','kt-alpha','mnb','aurora-world'];
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.moyeo_apply_confirm(now());
    raise exception 'FAIL: anonymous confirmation allowed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_UNAUTHENTICATED' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', 'c6610000-0000-4000-8000-000000000005', true);
  begin
    perform public.moyeo_apply_confirm(now());
    raise exception 'FAIL: unsubmitted confirmation allowed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_NOT_SUBMITTED' then raise; end if;
  end;
  if public.moyeo_apply_state()->'participants' <> 'null'::jsonb then
    raise exception 'FAIL: unsubmitted viewer can see confirmation statuses';
  end if;

  perform set_config('request.jwt.claim.sub', 'c6610000-0000-4000-8000-000000000001', true);
  v_state := public.moyeo_apply_state();
  v_before := (v_state#>>'{submission,updatedAt}')::timestamptz;
  if v_state#>'{submission,confirmedAt}' <> 'null'::jsonb then
    raise exception 'FAIL: existing submission auto-confirmed';
  end if;
  begin
    perform public.moyeo_apply_confirm(v_before - interval '1 second');
    raise exception 'FAIL: stale confirmation allowed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;
  v_result := public.moyeo_apply_confirm(v_before);
  if v_result->'changed' <> 'true'::jsonb
    or v_result#>'{submission,confirmedAt}' = 'null'::jsonb
    or v_result#>'{submission,editCount}' <> '2'::jsonb
    or v_result#>'{submission,choices}' <> to_jsonb(v_choices)
    or v_result#>'{submission,academicRank}' <> '12'::jsonb
    or (v_result#>>'{submission,updatedAt}')::timestamptz <= v_before then
    raise exception 'FAIL: confirmation at edit cap did not preserve data or refresh revision';
  end if;
  v_retry := public.moyeo_apply_confirm(v_before);
  if v_retry->'changed' <> 'false'::jsonb or v_retry->'submission' <> v_result->'submission' then
    raise exception 'FAIL: confirmation retry not idempotent';
  end if;
  begin
    perform public.moyeo_apply_save(array['car123','samjong-kpmg','kt-alpha','mnb','aurora-world'], 2, 12, v_before);
    raise exception 'FAIL: stale editor changed confirmed choices';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFIRMED' then raise; end if;
  end;
  begin
    perform public.moyeo_apply_save(v_choices, 2, null, (v_result#>>'{submission,updatedAt}')::timestamptz);
    raise exception 'FAIL: confirmed rank changed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFIRMED' then raise; end if;
  end;
  v_retry := public.moyeo_apply_save(v_choices, 2, 12, v_before);
  if v_retry->'changed' <> 'false'::jsonb then raise exception 'FAIL: unchanged save retry rejected'; end if;
  begin
    update public.moyeo_apply_submissions set confirmed_at = null;
    raise exception 'FAIL: direct unconfirm permitted';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', 'c6610000-0000-4000-8000-000000000002', true);
  v_state := public.moyeo_apply_state();
  if not exists (
    select 1 from jsonb_array_elements(v_state->'participants') p where p->'isConfirmed' = 'true'::jsonb
  ) or exists (
    select 1 from jsonb_array_elements(v_state->'participants') p where p ? 'academicRank' or p ? 'confirmedAt'
  ) then raise exception 'FAIL: confirmation status missing or private fields leaked'; end if;
  v_before := (v_state#>>'{submission,updatedAt}')::timestamptz;
  -- A save committed before confirmation must force the old confirmation dialog to reload.
  v_result := public.moyeo_apply_save(v_choices, 0, 5, v_before);
  begin
    perform public.moyeo_apply_confirm(v_before);
    raise exception 'FAIL: saved revision was ignored during confirmation';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFLICT' then raise; end if;
  end;
  v_result := public.moyeo_apply_confirm((v_result#>>'{submission,updatedAt}')::timestamptz);
  if v_result#>'{submission,editCount}' <> '1'::jsonb then
    raise exception 'FAIL: confirmation consumed an edit';
  end if;
  begin
    perform public.moyeo_apply_save(array['car123','samjong-kpmg','kt-alpha','mnb','aurora-world'], 1, 5, (v_result#>>'{submission,updatedAt}')::timestamptz);
    raise exception 'FAIL: remaining edit bypassed confirmation lock';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_CONFIRMED' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', 'c6610000-0000-4000-8000-000000000003', true);
  begin
    perform public.moyeo_apply_confirm((public.moyeo_apply_state()#>>'{submission,updatedAt}')::timestamptz);
    raise exception 'FAIL: incomplete choices confirmed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_INVALID_CHOICES' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', 'c6610000-0000-4000-8000-000000000004', true);
  begin
    perform public.moyeo_apply_confirm((public.moyeo_apply_state()#>>'{submission,updatedAt}')::timestamptz);
    raise exception 'FAIL: retired choices confirmed';
  exception when raise_exception then
    if sqlerrm <> 'APPLY_INVALID_CHOICES' then raise; end if;
  end;
  if has_function_privilege('anon', 'public.moyeo_apply_confirm(timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: anonymous RPC execute granted';
  end if;
end;
$$;
rollback;
