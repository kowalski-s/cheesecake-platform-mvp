# Supabase schema & RLS

## Быстрый деплой миграций (вручную)
1) Открой Supabase → SQL Editor.  
2) По очереди вставь содержимое файлов из `supabase/migrations` и жми **Run**.  
   Порядок:
   - 2025-11-03T1_01_is_admin.sql
   - 2025-11-03T1_02_rls_users.sql
   - 2025-11-03T1_03_rls_students_teachers_materials.sql

3) Перелогинься в приложении (или сделай hard refresh) — для админа появится `/admin`.

## Экспорт запросов из Supabase в файлы
В левом списке сохранённых запросов нажми **⋯ → Download as migration file** и сложи их в `supabase/migrations/`.

## Проверка
- В `public.users` у твоего uid должна быть роль `admin`.
- В браузере: зайди на `/admin`. Видишь панель — всё ок.
- Если словишь «infinite recursion» — удали любые «admin full access» на `public.users`.
