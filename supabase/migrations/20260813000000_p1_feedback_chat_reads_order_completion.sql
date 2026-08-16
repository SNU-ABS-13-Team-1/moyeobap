alter table public.pots
  add column if not exists order_completed_at timestamptz,
  add column if not exists order_completed_by text;

create table if not exists public.message_reads (
  pot_id text not null references public.pots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (pot_id, user_id)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 5 and 1000),
  page_path text check (page_path is null or char_length(page_path) <= 200),
  created_at timestamptz not null default now()
);

-- 기능 도입 전에 쌓인 메시지가 한꺼번에 새 메시지로 잡히지 않도록 기존
-- 참여자는 migration 적용 시점까지 읽은 것으로 시작합니다.
insert into public.message_reads (pot_id, user_id, last_read_at)
select pot_id, user_id::uuid, now()
from public.pot_participants
where user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (pot_id, user_id) do nothing;

create index if not exists idx_messages_pot_created_at
  on public.messages(pot_id, created_at desc);
create index if not exists idx_feedback_created_at
  on public.feedback(created_at desc);

alter table public.message_reads enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "message_reads_select_own" on public.message_reads;
create policy "message_reads_select_own"
on public.message_reads for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "message_reads_insert_own" on public.message_reads;
create policy "message_reads_insert_own"
on public.message_reads for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "message_reads_update_own" on public.message_reads;
create policy "message_reads_update_own"
on public.message_reads for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
on public.feedback for insert
to authenticated
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.message_reads to authenticated;
grant insert on public.feedback to authenticated;
