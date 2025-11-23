-- STUDENTS: студент видит только себя
drop policy if exists "students student read self" on public.students;
create policy "students student read self"
on public.students
as permissive
for select
to authenticated
using ( id = auth.uid() );

-- STUDENTS: преподаватель видит только своих учеников
drop policy if exists "students teacher read own" on public.students;
create policy "students teacher read own"
on public.students
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = auth.uid()
      and t.id = students.teacher_id
  )
);

-- TEACHERS: преподаватель читает свою строку
drop policy if exists "teachers teacher read self" on public.teachers;
create policy "teachers teacher read self"
on public.teachers
as permissive
for select
to authenticated
using ( id = auth.uid() );

-- TEACHERS: студент читает карточку своего преподавателя
drop policy if exists "teachers student read assigned" on public.teachers;
create policy "teachers student read assigned"
on public.teachers
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = auth.uid()
      and s.teacher_id = teachers.id
  )
);
