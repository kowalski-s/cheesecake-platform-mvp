-- Cheesecake School MVP Database Schema for Supabase

-- Extensions
create extension if not exists pgcrypto;

-- Users table mirrors roles for app (references auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text check (role in ('student','teacher','admin')) not null default 'student',
  student_id uuid,
  teacher_id uuid,
  created_at timestamptz default now()
);

-- Teachers
create table if not exists public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  created_at timestamptz default now()
);

-- Students
create table if not exists public.students (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  teacher_id uuid references public.teachers(id) on delete set null,
  remaining_lessons int default 0,
  created_at timestamptz default now()
);

-- Subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.students(id) on delete cascade,
  name text not null,
  remaining_lessons int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete cascade,
  title text not null,
  class_name text,
  start_at timestamptz not null,
  status text check (status in ('planned','done','canceled')) default 'planned',
  created_at timestamptz default now()
);

-- Materials (metadata; files in Storage bucket)
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text,
  description text,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Progress entries per student
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  content text,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.lessons enable row level security;
alter table public.materials enable row level security;
alter table public.progress enable row level security;

-- Helper policies
-- Admin can do anything
create policy "admin full access users" on public.users
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy "admin full access students" on public.students
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy "admin full access teachers" on public.teachers
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy "admin full access subscriptions" on public.subscriptions
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy "admin full access lessons" on public.lessons
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy "admin full access materials" on public.materials
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
create policy "admin full access progress" on public.progress
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Users can read their own profile
create policy "self read profile" on public.users
  for select using (id = auth.uid());

-- Student access policies
create policy "student read own" on public.students
  for select using (id = auth.uid());
create policy "student read own subscriptions" on public.subscriptions
  for select using (user_id = auth.uid());
create policy "student read own lessons" on public.lessons
  for select using (student_id = auth.uid());
create policy "student read own progress" on public.progress
  for select using (student_id = auth.uid());

-- Teacher access policies
create policy "teacher read self" on public.teachers
  for select using (id = auth.uid());
create policy "teacher read own students" on public.students
  for select using (teacher_id = auth.uid());
create policy "teacher read own lessons" on public.lessons
  for select using (teacher_id = auth.uid());
create policy "teacher update lesson status" on public.lessons
  for update using (teacher_id = auth.uid());

-- Materials: public read, write by owners
create policy "materials public read" on public.materials for select using (true);
create policy "materials owners insert" on public.materials for insert with check (owner_id = auth.uid());

-- Storage bucket for materials (run in SQL editor)
-- Select to create public bucket for materials
select storage.create_bucket('materials', public => true);