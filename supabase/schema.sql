create table if not exists public.hud_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.hud_state enable row level security;
alter table public.hud_state replica identity full;

grant usage on schema public to authenticated;
grant select, insert, update on public.hud_state to authenticated;

drop policy if exists "Users can read their HUD" on public.hud_state;
create policy "Users can read their HUD"
  on public.hud_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their HUD" on public.hud_state;
create policy "Users can create their HUD"
  on public.hud_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their HUD" on public.hud_state;
create policy "Users can update their HUD"
  on public.hud_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.touch_hud_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

drop trigger if exists touch_hud_state_before_update on public.hud_state;
create trigger touch_hud_state_before_update
  before update on public.hud_state
  for each row execute function public.touch_hud_state();

do $$
begin
  alter publication supabase_realtime add table public.hud_state;
exception
  when duplicate_object then null;
end
$$;

drop policy if exists "Users can receive their HUD broadcasts" on realtime.messages;
create policy "Users can receive their HUD broadcasts"
  on realtime.messages for select to authenticated
  using ((select realtime.topic()) = ('hud:' || (select auth.uid())::text));

drop policy if exists "Users can send their HUD broadcasts" on realtime.messages;
create policy "Users can send their HUD broadcasts"
  on realtime.messages for insert to authenticated
  with check ((select realtime.topic()) = ('hud:' || (select auth.uid())::text));