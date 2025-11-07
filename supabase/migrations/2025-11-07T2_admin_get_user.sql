-- Single-user lookup for admin pages, with email via v_users_full
create or replace function public.admin_get_user(
  p_id uuid
)
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  student_id uuid,
  teacher_id uuid,
  created_at timestamptz
) security definer set search_path = public as $$
begin
  if not public.current_is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select v.id, v.email, v.display_name, v.role, v.student_id, v.teacher_id, v.created_at
  from public.v_users_full v
  where v.id = p_id;
end;
$$;