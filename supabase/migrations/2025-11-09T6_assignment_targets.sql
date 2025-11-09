-- Assignment targets: link assignments to specific students
create table if not exists public.assignment_targets (
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id    uuid references public.students(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (assignment_id, student_id)
);

alter table public.assignment_targets enable row level security;

-- Policies
drop policy if exists at_select on public.assignment_targets;
create policy at_select on public.assignment_targets
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_targets.assignment_id
        and (
          t.user_id = auth.uid()
          or exists (select 1 from public.students s where s.id = assignment_targets.student_id and s.user_id = auth.uid())
        )
    )
  );

drop policy if exists at_modify_teacher on public.assignment_targets;
create policy at_modify_teacher on public.assignment_targets
  for all to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_targets.assignment_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id = assignment_targets.assignment_id
        and t.user_id = auth.uid()
    )
  );

-- Optional helpful index by student
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_at_student'
  ) then
    create index idx_at_student on public.assignment_targets(student_id);
  end if;
end $$;