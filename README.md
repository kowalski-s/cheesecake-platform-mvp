# Cheesecake School — MVP Platform

Frontend: React + Vite + Tailwind CSS
Backend/Auth/DB: Supabase (PostgreSQL, Auth, Storage)
Hosting: Netlify

This MVP lets students and teachers manage lessons, materials, and progress with simple role-based access.

## Features
- Student dashboard: subscription, upcoming/past lessons, progress, materials
- Teacher dashboard: schedule, student list, mark conducted lessons
- Admin panel: lists of students/teachers, ending subscription filter
- Auth: register/login/forgot via Supabase Auth
- Materials: upload/list via Supabase Storage bucket `materials`
- Schedule filter: by teacher, class, status

## Setup
1) Clone and install deps
```
npm install
```

2) Tailwind is configured via `tailwind.config.js` and `postcss.config.js` (already added).

3) Create a Supabase project and set env vars
Create `.env` from `.env.example` and fill:
```
VITE_SUPABASE_URL=...your supabase url...
VITE_SUPABASE_ANON_KEY=...anon key...
```

4) Apply database schema in Supabase SQL Editor
Open `supabase/schema.sql` and run its contents:
- Tables: `users, teachers, students, subscriptions, lessons, materials, progress`
- RLS policies for basic role-based access
- Storage bucket creation: `materials` (public)

5) Pages and routes
- `/login`, `/register`, `/forgot`
- `/dashboard` (student or teacher view based on role)
- `/schedule`, `/materials`, `/admin` (admin only)

6) Development
```
npm run dev
```
Open http://localhost:5173

## Netlify Deploy
1) Push repo to GitHub
2) Create a new site on Netlify, choose your repo
3) Build command: `npm run build`, Publish directory: `dist` (via `netlify.toml`)
4) Set environment variables in Netlify UI:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5) Deploy. After deploy, update Supabase Auth redirect URLs to include your Netlify domain.

## Local Dev with Netlify
- cp `.env.example` `.env.local`
- Fill 4 vars:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Install deps: `npm i`
- Start Netlify Dev: `npx netlify-cli dev` (or `npm run dev:netlify`)
- App: `http://localhost:8888` (proxies to Vite `5175`)
- Functions health: `http://localhost:8888/.netlify/functions/health`

Notes:
- If port `8888` is busy, change `port = 9999` in `netlify.toml` and re-run.
- Vite dev server runs on `5175` with `strictPort: true`, so it fails fast if taken.
- Optional: `npm run check:ports` to detect conflicts on `5175`/`8888` and get Windows-friendly commands to free ports.

### Seed demo data via PowerShell
Seeder endpoint: `POST /.netlify/functions/seed-demo` (requires admin). Steps:

1) Login locally and make your user an admin (one-time bootstrap):
- In Supabase, open SQL Editor and run:
```
-- replace <your_auth_uid> with your actual auth user id
insert into public.users (id, role, display_name)
values ('<your_auth_uid>', 'admin', 'Admin');
```

2) Get your access token in the browser DevTools Console:
```
// in the running app: http://localhost:8888
const { data: { session } } = await supabase.auth.getSession();
copy(session.access_token);
```

3) Call the seeder with PowerShell (Windows):
```
$token = Read-Host 'Paste your access token'
Invoke-RestMethod \
  -Uri 'http://localhost:8888/.netlify/functions/seed-demo' \
  -Method POST \
  -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } \
  -Body '{}'
```

If you prefer raw output:
```
$token = Read-Host 'Paste your access token'
Invoke-WebRequest \
  -Uri 'http://localhost:8888/.netlify/functions/seed-demo' \
  -Method POST \
  -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } \
  -Body '{}' | Select-Object -ExpandProperty Content
```

On success, you will see JSON like:
```
{ "ok": true, "message": "Демо-данные созданы", "details": { "counts": { ... } } }
```

## Roles
- Roles live in `public.users.role` and are set on registration to `student` by default.
- Manually update role to `teacher`/`admin` in Supabase if needed.
- Teacher/student entity rows must be created for proper relations.

## Notes
- This is MVP: no payments, no video calls, no external backend.
- Materials security: bucket is public; for production, make private and sign URLs.
- Styling uses minimal white/orange theme with smooth transitions.

## SQL quick start (examples)
- Create a teacher:
```
insert into public.users (id, role, display_name) values ('<auth.uid>', 'teacher', 'Teacher Name');
insert into public.teachers (id, display_name) values ('<auth.uid>', 'Teacher Name');
```
- Assign a student to a teacher:
```
update public.students set teacher_id = '<teacher-uuid>' where id = '<student-uuid>';
```
