-- View: student_progress
-- Shows number of done lessons and total lessons per student
create or replace view public.student_progress as
select s.id as student_id,
       count(l.*) filter (where l.status = 'done') as done,
       count(l.*) as total
from public.students s
left join public.lessons l on l.student_id = s.id
group by s.id;

-- Grant read to common roles
grant select on public.student_progress to authenticated, anon;