-- Функция: проверка «админ ли пользователь»
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role = 'admin'
  );
$$;
