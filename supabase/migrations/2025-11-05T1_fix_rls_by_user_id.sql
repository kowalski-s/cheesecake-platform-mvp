-- Fix RLS policies to use user_id for teacher/student mapping

-- STUDENTS table: select/update policies
alter table if exists public.students enable row level security;

-- Drop incorrect policies (id = auth.uid())
drop policy if exists "students student read self" on public.students;
drop policy if exists "students teacher read own" on public.students;

-- Student reads own row via user_id
create policy "students student read self"
on public.students
as permissive
for select
to authenticated
using ( user_id = auth.uid() );

-- Student updates own row via user_id
drop policy if exists "students student update self" on public.students;
create policy "students student update self"
on public.students
as permissive
for update
to authenticated
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );

-- Teacher reads only their students via join on teachers.user_id
create policy "students teacher read own"
on public.students
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and t.id = students.teacher_id
  )
);

-- TEACHERS table: select/update policies
alter table if exists public.teachers enable row level security;

drop policy if exists "teachers teacher read self" on public.teachers;
drop policy if exists "teachers student read assigned" on public.teachers;
drop policy if exists "teachers teacher update self" on public.teachers;

-- Teacher reads own row
create policy "teachers teacher read self"
on public.teachers
as permissive
for select
to authenticated
using ( user_id = auth.uid() );

-- Student reads their assigned teacher
create policy "teachers student read assigned"
on public.teachers
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.user_id = auth.uid()
      and s.teacher_id = teachers.id
  )
);

-- Teacher updates own row
create policy "teachers teacher update self"
on public.teachers
as permissive
for update
to authenticated
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );

-- LESSONS table: select/insert/update for teacher; select for student
alter table if exists public.lessons enable row level security;

drop policy if exists "teacher read own lessons" on public.lessons;

-- Teacher reads own lessons via mapping teachers.user_id -> auth.uid()
create policy "teacher read own lessons"
on public.lessons
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and t.id = lessons.teacher_id
  )
);

-- Teacher inserts lessons only for themselves
drop policy if exists "teacher insert own lessons" on public.lessons;
create policy "teacher insert own lessons"
on public.lessons
as permissive
for insert
to authenticated
with check (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and t.id = lessons.teacher_id
  )
);

-- Teacher updates lessons only for themselves
drop policy if exists "teacher update own lessons" on public.lessons;
create policy "teacher update own lessons"
on public.lessons
as permissive
for update
to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and t.id = lessons.teacher_id
  )
)
with check (
  exists (
    select 1 from public.teachers t
    where t.user_id = auth.uid()
      and t.id = lessons.teacher_id
  )
);

-- Student reads only own lessons via students.user_id
drop policy if exists "student read own lessons" on public.lessons;
create policy "student read own lessons"
on public.lessons
as permissive
for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.user_id = auth.uid()
      and s.id = lessons.student_id
  )
);

-- Admin full access policies remain defined in earlier migrations via public.is_admin
-- No changes to public.users policies here to avoid recursion.