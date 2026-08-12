-- 앱 서버만 핵심 데이터를 쓰고, 브라우저 공개 키는 API를 우회할 수 없게 합니다.
-- 채팅 Realtime 조회만 해당 팟 참여자에게 직접 허용합니다.

create or replace function public.is_pot_participant(target_pot_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pot_participants
    where pot_id = target_pot_id
      and user_id = (select auth.uid())::text
  );
$$;

revoke all on function public.is_pot_participant(text) from public;
grant execute on function public.is_pot_participant(text) to authenticated;

drop policy if exists "Allow public select restaurants" on public.restaurants;
drop policy if exists "Allow public insert restaurants" on public.restaurants;

drop policy if exists "Allow public select pots" on public.pots;
drop policy if exists "Allow public insert pots" on public.pots;
drop policy if exists "Allow public update pots" on public.pots;

drop policy if exists "Allow public select pot_participants" on public.pot_participants;
drop policy if exists "Allow public insert pot_participants" on public.pot_participants;
drop policy if exists "Allow public delete pot_participants" on public.pot_participants;

drop policy if exists "Allow public select messages" on public.messages;
drop policy if exists "Allow public insert messages" on public.messages;
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages for select
to authenticated
using (public.is_pot_participant(pot_id));

revoke all on public.restaurants from anon, authenticated;
revoke all on public.pots from anon, authenticated;
revoke all on public.pot_participants from anon, authenticated;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

-- 계좌는 profiles와 사용자가 직접 공유한 채팅 메시지만 정본으로 사용합니다.
-- 과거 참여자 행에 복제된 계좌 사본은 더 이상 필요하지 않습니다.
update public.pot_participants
set bank_account = null
where bank_account is not null;
