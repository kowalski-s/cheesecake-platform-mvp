-- Включаем RLS (если не включён)
alter table if exists public.students enable row level security;
alter table if exists public.teachers enable row level security;
alter table if exists public.materials enable row level security;

-- Админам полный доступ к students/teachers/materials через функцию is_admin()
-- (без обращения обратно к этим таблицам; безопасно)
-- STUDENTS
drop policy if exists "admin full access students" on public.students;
create policy "admin full access students"
on public.students
as permissive
for all
to authenticated
using      ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- TEACHERS
drop policy if exists "admin full access teachers" on public.teachers;
create policy "admin full access teachers"
on public.teachers
as permissive
for all
to authenticated
using      ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- MATERIALS
drop policy if exists "admin full access materials" on public.materials;
create policy "admin full access materials"
on public.materials
as permissive
for all
to authenticated
using      ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );
