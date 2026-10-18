-- Run with the real profiles migration and all Apply migrations, in a disposable DB.
begin;
insert into auth.users(id, email) values
 ('e6610000-0000-4000-8000-000000000001','audit-a@example.invalid'),
 ('e6610000-0000-4000-8000-000000000002','audit-b@example.invalid');
insert into public.profiles(id, display_name) values
 ('e6610000-0000-4000-8000-000000000001','audit-name-a'),
 ('e6610000-0000-4000-8000-000000000002','audit-name-b')
on conflict (id) do update set display_name = excluded.display_name;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e6610000-0000-4000-8000-000000000001', true);
do $$
declare
  bad text[];
  result jsonb;
  choices text[] := array['car123','kt-alpha','mnb','aurora-world','samjong-kpmg'];
  fn regprocedure;
begin
  -- Direct REST/GraphQL selects have these same table privileges and RLS.
  begin
    perform s.choices from public.moyeo_apply_submissions s;
    raise exception 'FAIL: raw table select allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.moyeo_apply_submissions(user_id, choices, is_name_public)
    values ('e6610000-0000-4000-8000-000000000002', choices, true);
    raise exception 'FAIL: forged row insert allowed';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.profiles where id = 'e6610000-0000-4000-8000-000000000002') then
    raise exception 'FAIL: other profile directly readable';
  end if;
  update public.profiles set display_name = 'attacked' where id = 'e6610000-0000-4000-8000-000000000002';
  if found then raise exception 'FAIL: other profile writable'; end if;

  for bad in select value from (values
    (null::text[]),
    ('[0:4]={car123,kt-alpha,mnb,aurora-world,samjong-kpmg}'::text[]),
    (array[['car123','kt-alpha','mnb','aurora-world','samjong-kpmg']]),
    (array['car123','kt-alpha','mnb','aurora-world',null]),
    (array['car123','kt-alpha','mnb','aurora-world','']),
    (array['car123','kt-alpha','mnb','aurora-world','''; select * from profiles; --'])
  ) invalid(value) loop
    begin
      perform public.moyeo_apply_save(bad);
      raise exception 'FAIL: malformed direct RPC choices allowed';
    exception when raise_exception then
      if sqlerrm <> 'APPLY_INVALID_CHOICES' then raise; end if;
    end;
  end loop;
  if public.moyeo_apply_state()->'participants' <> 'null'::jsonb then
    raise exception 'FAIL: failed saves unlocked list';
  end if;
  result := public.moyeo_apply_save(choices);
  if result->'privacyVersion' <> '1'::jsonb
    or public.moyeo_apply_state()->'privacyVersion' <> '1'::jsonb then
    raise exception 'FAIL: policy version missing';
  end if;
  -- A guessed or injected user identity cannot be passed into any Apply RPC.
  for fn in select oid::regprocedure from pg_proc
    where pronamespace = 'public'::regnamespace and proname like 'moyeo_apply_%'
  loop
    if has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception 'FAIL: anon can execute %', fn;
    end if;
    if exists (select 1 from pg_proc where oid = fn and (
      not prosecdef or not coalesce(proconfig @> array['search_path=""'], false)
      or array_to_string(proargnames, ',') ~ '(user_id|userId|is_admin)'
    )) then raise exception 'FAIL: unsafe RPC identity or search_path %', fn; end if;
  end loop;
  if to_regprocedure('public.moyeo_apply_save(text[],integer)') is not null then
    raise exception 'FAIL: legacy save overload survives';
  end if;
  if exists (select 1 from pg_class where oid in (
    'public.moyeo_apply_submissions'::regclass,'public.moyeo_apply_companies'::regclass,'public.profiles'::regclass
  ) and not relrowsecurity) then raise exception 'FAIL: RLS disabled'; end if;
end;
$$;
-- The database must block anonymous execution even with a fabricated subject.
set local role anon;
do $$
begin
  begin
    perform public.moyeo_apply_state();
    raise exception 'FAIL: anon RPC with spoofed subject allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
