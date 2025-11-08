-- Sprint 2: assignments & submissions + storage buckets

-- Create buckets if missing (idempotent)
do $$ begin
  if not exists (select 1 from storage.buckets where name = 'materials') then
    perform storage.create_bucket('materials', public => true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from storage.buckets where name = 'submissions') then
    perform storage.create_bucket('submissions', public => false);
  end if;
end $$;

-- Assignments table
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date timestamptz,
  teacher_id uuid references public.teachers(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  created_at timestamptz default now()
);

-- Submissions table
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id uuid references public.students(id),
  file_path text,
  grade text,
  feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- updated_at trigger for submissions
create or replace function public.touch_submissions_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_submissions_updated_at'
  ) then
    create trigger trg_submissions_updated_at
    before update on public.submissions
    for each row execute function public.touch_submissions_updated_at();
  end if;
end $$;

-- Enable RLS
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- Admin full access
create policy if not exists "admin full access assignments" on public.assignments
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy if not exists "admin full access submissions" on public.submissions
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Teacher policies for assignments
create policy if not exists "teacher manage own assignments" on public.assignments
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- Student can read assignments by their teacher
create policy if not exists "student read assignments by own teacher" on public.assignments
  for select using (
    exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.teacher_id = assignments.teacher_id
    )
  );

-- Submissions policies
-- Students: insert/update/select own submissions
create policy if not exists "student insert own submissions" on public.submissions
  for insert with check (student_id = auth.uid());
create policy if not exists "student update own submissions" on public.submissions
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy if not exists "student read own submissions" on public.submissions
  for select using (student_id = auth.uid());

-- Teachers: read/update submissions for their assignments
create policy if not exists "teacher read submissions for own assignments" on public.submissions
  for select using (
    exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  );
create policy if not exists "teacher update grade/feedback on own assignments" on public.submissions
  for update using (
    exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  );