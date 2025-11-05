alter table if exists public.teachers enable row level security;
drop policy if exists "teachers teacher update self" on public.teachers;
create policy "teachers teacher update self"
on public.teachers
as permissive
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());