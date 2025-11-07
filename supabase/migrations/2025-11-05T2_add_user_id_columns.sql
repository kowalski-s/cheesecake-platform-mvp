-- Add user_id to teachers/students and backfill from existing id

alter table if exists public.teachers add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table if exists public.students add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Backfill: set user_id = id for existing rows
update public.teachers set user_id = id where user_id is null;
update public.students set user_id = id where user_id is null;

-- Partial unique indexes: only enforce uniqueness when user_id is not null
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'teachers_user_id_unique') then
    create unique index teachers_user_id_unique on public.teachers(user_id) where user_id is not null;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'students_user_id_unique') then
    create unique index students_user_id_unique on public.students(user_id) where user_id is not null;
  end if;
end $$;

-- Convenience view for listing users with email (admin-only usage via RPC)
create or replace view public.v_users_full as
select u.id,
       au.email,
       u.display_name,
       u.role,
       u.student_id,
       u.teacher_id,
       u.created_at
from public.users u
left join auth.users au on au.id = u.id;