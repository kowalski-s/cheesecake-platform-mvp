-- RLS для таблицы public.users
alter table if exists public.users enable row level security;

-- читать свой профиль
drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
as permissive
for select
to authenticated
using ( id = auth.uid() );

-- вставлять свою же строку (id должен совпадать с auth.uid())
drop policy if exists users_insert_own on public.users;
create policy users_insert_own
on public.users
as permissive
for insert
to authenticated
with check ( id = auth.uid() );

-- обновлять только свою строку
drop policy if exists users_update_own on public.users;
create policy users_update_own
on public.users
as permissive
for update
to authenticated
using ( id = auth.uid() )
with check ( id = auth.uid() );

-- NOTE: НИКАКИХ "admin full access" на users — это вызывало рекурсию.
