-- Ensure lessons has required fields and robust RLS for roles

-- Add columns if missing
alter table if exists public.lessons
  add column if not exists end_at timestamptz,
  add column if not exists duration_min int,
  add column if not exists comment text;

-- Indexes for range queries
create index if not exists lessons_start_at_idx on public.lessons (start_at);
create index if not exists lessons_teacher_id_idx on public.lessons (teacher_id);
create index if not exists lessons_student_id_idx on public.lessons (student_id);

-- Enable RLS
alter table public.lessons enable row level security;

-- Drop old policies to avoid conflicts
drop policy if exists "admin full access lessons" on public.lessons;
drop policy if exists "student read own lessons" on public.lessons;
drop policy if exists "teacher read own lessons" on public.lessons;
drop policy if exists "teacher update lesson status" on public.lessons;

-- Admin/manager full access
create policy "admin full access lessons" on public.lessons
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and (u.role = 'admin' or u.role = 'manager'))
  );

-- Teacher: read own lessons
create policy "teacher read own lessons" on public.lessons
  for select using (
    lessons.teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid())
  );

-- Student: read own lessons
create policy "student read own lessons" on public.lessons
  for select using (
    lessons.student_id in (select s.id from public.students s where s.user_id = auth.uid())
  );

-- Teacher: insert own lessons
create policy "teacher insert own lessons" on public.lessons
  for insert with check (
    lessons.teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid())
  );

-- Teacher: update own lessons
create policy "teacher update own lessons" on public.lessons
  for update using (
    lessons.teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid())
  );

-- Teacher: delete own lessons
create policy "teacher delete own lessons" on public.lessons
  for delete using (
    lessons.teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid())
  );

-- Note: if roles table doesn't have 'manager', this policy still works for 'admin';
-- you can add 'manager' as a role in users.role enum and assign accordingly.