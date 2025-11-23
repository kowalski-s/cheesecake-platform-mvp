-- Включаем RLS на lessons
alter table if exists public.lessons enable row level security;

-- Админ: полный доступ
drop policy if exists "admin full access lessons" on public.lessons;
create policy "admin full access lessons"
on public.lessons
as permissive
for all
to authenticated
using      ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- Преподаватель: читать только свои уроки
drop policy if exists "teacher read own lessons" on public.lessons;
create policy "teacher read own lessons"
on public.lessons
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = auth.uid()
      and t.id = lessons.teacher_id
  )
);

-- Студент: читать только свои уроки
drop policy if exists "student read own lessons" on public.lessons;
create policy "student read own lessons"
on public.lessons
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = auth.uid()
      and s.id = lessons.student_id
  )
);
