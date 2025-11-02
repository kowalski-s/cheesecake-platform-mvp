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
