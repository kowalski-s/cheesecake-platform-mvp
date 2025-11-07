-- RPC functions for admin operations

-- Helper: check admin
create or replace function public.current_is_admin()
returns boolean language sql stable as $$
  select coalesce(public.is_admin(auth.uid()), false);
$$;

-- List users with email, search, pagination
create or replace function public.admin_list_users(
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
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
  if not current_is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select v.id, v.email, v.display_name, v.role, v.student_id, v.teacher_id, v.created_at
  from public.v_users_full v
  where (
    p_search is null
    or v.email ilike '%' || p_search || '%'
    or v.display_name ilike '%' || p_search || '%'
    or v.role ilike '%' || p_search || '%'
  )
  order by v.created_at desc
  limit p_limit offset p_offset;
end;
$$;

-- Change role safely
create or replace function public.admin_set_role(
  p_user_id uuid,
  p_new_role text
)
returns boolean security definer set search_path = public as $$
declare
  v_role text;
begin
  if not current_is_admin() then
    raise exception 'forbidden';
  end if;

  v_role := lower(trim(coalesce(p_new_role, '')));
  if v_role not in ('admin','teacher','student') then
    raise exception 'invalid role';
  end if;

  update public.users set role = v_role where id = p_user_id;
  return true;
end;
$$;

-- List auth users by target role (from public.users), for binding user_id
create or replace function public.admin_list_role_users(
  p_role text,
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  email text,
  display_name text,
  role text
) security definer set search_path = public as $$
begin
  if not current_is_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select v.id, v.email, v.display_name, v.role
  from public.v_users_full v
  where v.role = lower(trim(p_role))
    and (
      p_search is null
      or v.email ilike '%' || p_search || '%'
      or v.display_name ilike '%' || p_search || '%'
    )
  order by v.display_name nulls last, v.email
  limit p_limit offset p_offset;
end;
$$;