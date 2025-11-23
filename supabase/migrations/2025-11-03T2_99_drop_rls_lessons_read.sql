-- Откат политик для lessons
drop policy if exists "admin full access lessons"   on public.lessons;
drop policy if exists "teacher read own lessons"    on public.lessons;
drop policy if exists "student read own lessons"    on public.lessons;

-- Откат политик чтения для students/teachers
drop policy if exists "students student read self"  on public.students;
drop policy if exists "students teacher read own"   on public.students;
drop policy if exists "teachers teacher read self"  on public.teachers;
drop policy if exists "teachers student read assigned" on public.teachers;
