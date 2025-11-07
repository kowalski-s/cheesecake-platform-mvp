// Netlify Function: POST /.netlify/functions/seed-demo
// Seeds demo data (users, teachers, students, lessons, materials).
// Access: admin-only. Uses Supabase service key, checks caller admin role.

import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' }
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) }
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Supabase env missing' }) }
    }
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const authHeader = event.headers?.authorization || event.headers?.Authorization
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) }
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: userData, error: getUserError } = await client.auth.getUser(token)
    if (getUserError || !userData?.user?.id) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unauthorized user' }) }
    }
    const callerId = userData.user.id

    // Check admin role in public.users
    const { data: me, error: meError } = await client
      .from('users')
      .select('id, role')
      .eq('id', callerId)
      .maybeSingle()
    if (meError || !me || String(me.role || '').toLowerCase() !== 'admin') {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Forbidden' }) }
    }

    // Idempotency via unique emails and demo markers
    const adminEmail = 'admin.demo@cheesecake.school'
    const teacherEmails = ['teacher1.demo@cheesecake.school', 'teacher2.demo@cheesecake.school', 'teacher3.demo@cheesecake.school']
    const studentEmails = Array.from({ length: 10 }).map((_, i) => `student${String(i + 1).padStart(2, '0')}.demo@cheesecake.school`)

    const ensureUser = async ({ email, display_name, role, password = 'demopass123' }) => {
      // Try fetch by email
      const { data: byEmail } = await client.auth.admin.getUserByEmail(email)
      let userId = byEmail?.user?.id || null
      if (!userId) {
        const { data: created, error: createErr } = await client.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name },
        })
        if (createErr) throw createErr
        userId = created?.user?.id
      }
      if (!userId) throw new Error('Failed to provision auth user')
      const { error: upErr } = await client.from('users').upsert({ id: userId, display_name, role })
      if (upErr) throw upErr
      return userId
    }

    // Admin user
    const adminId = await ensureUser({ email: adminEmail, display_name: 'Demo Admin', role: 'admin' })

    // Teachers
    const teacherIds = []
    for (let i = 0; i < teacherEmails.length; i++) {
      const email = teacherEmails[i]
      const display_name = `Teacher ${i + 1}`
      const tid = await ensureUser({ email, display_name, role: 'teacher' })
      teacherIds.push(tid)
      const bio = i === 0 ? 'HSK1 / Общий курс' : i === 1 ? 'Разговорная практика' : 'Грамматика и фонетика'
      await client.from('teachers').upsert({ id: tid, display_name, bio, user_id: tid })
    }

    // Students + Subscriptions
    const studentIds = []
    for (let i = 0; i < studentEmails.length; i++) {
      const email = studentEmails[i]
      const display_name = `Student ${i + 1}`
      const sid = await ensureUser({ email, display_name, role: 'student' })
      studentIds.push(sid)
      const teacher_id = teacherIds[i % teacherIds.length]
      const remaining = 4 + Math.floor(Math.random() * 16) // 4..19

      await client.from('students').upsert({ id: sid, display_name, teacher_id, remaining_lessons: remaining, user_id: sid })

      // Ensure one active subscription; compute created_at to make end date ~ within 60 days
      const now = new Date()
      const startDaysAgo = Math.floor(Math.random() * 30) // 0..29 days ago
      const created_at = new Date(now.getTime() - startDaysAgo * 24 * 3600 * 1000).toISOString()
      const { data: existingSub } = await client
        .from('subscriptions')
        .select('id')
        .eq('user_id', sid)
        .eq('active', true)
        .limit(1)
      if (!existingSub || existingSub.length === 0) {
        await client.from('subscriptions').insert({ user_id: sid, name: 'Демо абонемент', remaining_lessons: remaining, active: true, created_at })
      } else {
        // Keep idempotency: update remaining to match student
        const subId = existingSub[0]?.id
        if (subId) {
          await client.from('subscriptions').update({ remaining_lessons: remaining }).eq('id', subId)
        }
      }
    }

    // Materials (owner: admin)
    const materials = Array.from({ length: 6 }).map((_, i) => ({
      storage_path: `materials/demo-${i + 1}.pdf`,
      title: `Demo Material ${i + 1}`,
      description: 'Учебный материал для демонстрации',
      owner_id: adminId,
    }))
    for (const m of materials) {
      const { data: exists } = await client.from('materials').select('id').eq('storage_path', m.storage_path).limit(1)
      if (!exists || exists.length === 0) {
        await client.from('materials').insert(m)
      }
    }

    // Lessons: skip if already have demo lessons
    const { data: demoLessonsCheck } = await client
      .from('lessons')
      .select('id')
      .ilike('title', 'DEMO%')
      .limit(1)
    if (!demoLessonsCheck || demoLessonsCheck.length === 0) {
      const classNames = ['HSK1', 'HSK2', 'Разговорный', 'Грамматика', 'Фонетика']
      const statuses = ['planned', 'done', 'canceled']
      const now = Date.now()
      const toInsert = []
      for (let i = 0; i < 20; i++) {
        const teacher_id = teacherIds[i % teacherIds.length]
        const student_id = studentIds[i % studentIds.length]
        const offsetDays = Math.floor(Math.random() * 29) - 14 // -14..+14
        const start_at = new Date(now + offsetDays * 24 * 3600 * 1000)
        start_at.setHours(10 + (i % 8), 0, 0, 0)
        const title = `DEMO Lesson ${i + 1}`
        const class_name = classNames[i % classNames.length]
        const status = statuses[i % statuses.length]
        toInsert.push({ student_id, title, class_name, start_at: start_at.toISOString(), status, teacher_id })
      }
      // Insert in batches
      while (toInsert.length) {
        const chunk = toInsert.splice(0, 10)
        await client.from('lessons').insert(chunk)
      }
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, message: 'Demo data seeded' }) }
  } catch (err) {
    console.error('seed-demo error', err)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: String(err?.message || err) }) }
  }
}