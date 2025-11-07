-- Add teacher_id to lessons table to support joins and RLS
-- This aligns with policies referencing lessons.teacher_id and enables seeder inserts

alter table if exists public.lessons
  add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

-- Helpful index for filtering by teacher
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'lessons_teacher_id_idx'
  ) then
    create index lessons_teacher_id_idx on public.lessons(teacher_id);
  end if;
end $$;