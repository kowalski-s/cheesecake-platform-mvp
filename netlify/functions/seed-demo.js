// /.netlify/functions/seed-demo.js — ESM (без onConflict, ручной upsert)
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY
const isDev = process.env.NETLIFY_DEV === 'true'

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'POST,OPTIONS'
    }
  })

// ---------- Admin helpers (SDK v2, с REST-фолбэком) ----------
async function adminGetUserByEmail(email) {
  const hasSdk = admin?.auth?.admin && typeof admin.auth.admin.getUserByEmail === 'function'
  if (hasSdk) {
    const { data, error } = await admin.auth.admin.getUserByEmail(email)
    if (error && error.message !== 'User not found') throw new Error(`getUserByEmail failed: ${error.message}`)
    return data?.user || null
  }
  // REST fallback
  const rsp = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
  })
  if (!rsp.ok) throw new Error(`admin GET by email failed: ${rsp.status} ${await rsp.text()}`)
  const data = await rsp.json()
  const users = Array.isArray(data) ? data : data?.users
  return users && users.length ? users[0] : null
}

async function adminCreateUser({ email, password }) {
  const hasSdk = admin?.auth?.admin && typeof admin.auth.admin.createUser === 'function'
  if (hasSdk) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`createUser failed: ${error.message}`)
    return data?.user
  }
  // REST fallback
  const rsp = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ email, password, email_confirm: true })
  })
  if (!rsp.ok) throw new Error(`admin createUser failed: ${rsp.status} ${await rsp.text()}`)
  return await rsp.json()
}

// ---------- DB helpers (ручной "upsert") ----------
async function ensureUser(email, role, displayName) {
  // auth.users ↔ users
  let uid = null
  const found = await adminGetUserByEmail(email)
  if (found?.id) uid = found.id
  else {
    const pwd = crypto.randomBytes(12).toString('hex')
    const created = await adminCreateUser({ email, password: pwd })
    uid = created?.id || created?.user?.id
    if (!uid) throw new Error(`No id returned for ${email} after create`)
  }
  const { error: upErr } = await admin.from('users').upsert({
    id: uid,
    role,
    display_name: displayName || email.split('@')[0]
  })
  if (upErr) throw new Error(`users upsert failed for ${email}: ${upErr.message}`)
  return uid
}

async function ensureTeacherByUserId(user_id, display_name, bio = 'DEMO bio') {
  const { data: ex, error: selErr } = await admin.from('teachers').select('id').eq('user_id', user_id).maybeSingle()
  if (selErr) throw new Error(`teachers select failed: ${selErr.message}`)
  if (!ex) {
    const { data, error } = await admin.from('teachers').insert({
      id: crypto.randomUUID(),
      user_id, display_name, bio
    }).select('id').maybeSingle()
    if (error) throw new Error(`teachers insert failed: ${error.message}`)
    return data.id
  } else {
    const { data, error } = await admin.from('teachers').update({ display_name, bio }).eq('id', ex.id).select('id').maybeSingle()
    if (error) throw new Error(`teachers update failed: ${error.message}`)
    return data.id
  }
}

async function ensureStudentByUserId(user_id, display_name, teacher_id, remaining_lessons = 8) {
  // В этой схеме students.id -> users.id, поэтому id = user_id
  // 1) пробуем найти по id (т.к. это и есть user_id)
  const { data: ex, error: selErr } = await admin
    .from('students')
    .select('id')
    .eq('id', user_id)
    .maybeSingle()
  if (selErr) throw new Error(`students select failed: ${selErr.message}`)

  if (!ex) {
    // INSERT: id = user_id (удовлетворяем FK students_id_fkey)
    const { data, error } = await admin
      .from('students')
      .insert({
        id: user_id,               // <-- ключевой фикс
        user_id,                   // если колонка есть — пусть будет консистентна
        display_name,
        teacher_id,
        remaining_lessons
      })
      .select('id,teacher_id')
      .maybeSingle()
    if (error) throw new Error(`students insert failed: ${error.message}`)
    return data
  } else {
    // UPDATE: по id = user_id
    const { data, error } = await admin
      .from('students')
      .update({
        user_id,                   // не помешает держать в актуальном состоянии
        display_name,
        teacher_id,
        remaining_lessons
      })
      .eq('id', user_id)
      .select('id,teacher_id')
      .maybeSingle()
    if (error) throw new Error(`students update failed: ${error.message}`)
    return data
  }
}

// ------------------- Handler -------------------
export default async (req) => {
  if (req.method === 'OPTIONS') return json(200, { ok: true })
  if (!url || !serviceKey) {
    return json(500, { ok: false, message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY for seed-demo' })
  }

  // В проде — проверка токена и роли admin
  if (!isDev) {
    try {
      const auth = req.headers.get('authorization') || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (!token) return json(401, { ok: false, message: 'Missing Bearer token' })
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data?.user) return json(401, { ok: false, message: 'Invalid token' })
      const uid = data.user.id
      const { data: pu, error: pErr } = await admin.from('users').select('role').eq('id', uid).maybeSingle()
      if (pErr) return json(500, { ok: false, message: `Check admin role failed: ${pErr.message}` })
      if (!pu || pu.role !== 'admin') return json(403, { ok: false, message: 'Only admin can seed' })
    } catch (e) {
      return json(500, { ok: false, message: `Admin check error: ${e.message || String(e)}` })
    }
  }

  try {
    // 1) Users
    const teacherEmails = ['teacher1.demo@cheesecake.school','teacher2.demo@cheesecake.school','teacher3.demo@cheesecake.school']
    const studentEmails = Array.from({ length: 10 }, (_, i) => `student${String(i+1).padStart(2,'0')}.demo@cheesecake.school`)
    const adminEmail = 'admin.demo@cheesecake.school'

    await ensureUser(adminEmail, 'admin', 'Admin Demo')

    const teacherIdsByUser = []
    for (let i = 0; i < teacherEmails.length; i++) {
      const uid = await ensureUser(teacherEmails[i], 'teacher', `Teacher ${i+1}`)
      teacherIdsByUser.push(uid)
    }
    const studentUserIds = []
    for (let i = 0; i < studentEmails.length; i++) {
      const uid = await ensureUser(studentEmails[i], 'student', `Student ${String(i+1).padStart(2,'0')}`)
      studentUserIds.push(uid)
    }

    // 2) Teachers (ручной upsert по user_id)
    const teacherRows = []
    for (let i = 0; i < teacherIdsByUser.length; i++) {
      const tid = await ensureTeacherByUserId(teacherIdsByUser[i], `Teacher ${i+1}`, 'DEMO bio')
      teacherRows.push({ id: tid, user_id: teacherIdsByUser[i] })
    }

    // 3) Students (ручной upsert + привязка к учителю по кругу)
    const studentRows = []
    for (let i = 0; i < studentUserIds.length; i++) {
      const teacher = teacherRows[i % teacherRows.length]
      const s = await ensureStudentByUserId(
        studentUserIds[i],
        `Student ${String(i+1).padStart(2,'0')}`,
        teacher.id,
        8
      )
      studentRows.push(s) // { id, teacher_id }
    }

    // 4) Lessons: чистим только DEMO и создаём новые
    await admin.from('lessons').delete().like('title', 'DEMO%')

    const lessons = []
    for (let i = 0; i < Math.min(20, studentRows.length); i++) {
      const s = studentRows[i]
      lessons.push({
        title: `DEMO Lesson ${i+1}`,
        teacher_id: s.teacher_id,
        student_id: s.id,
        start_at: new Date(Date.now() + i*24*3600*1000).toISOString(),
        duration: 60,
        status: 'planned',
        class_name: 'HSK1'
      })
    }
    if (lessons.length) {
      const { error: lErr } = await admin.from('lessons').insert(lessons)
      if (lErr) throw new Error(`Insert lessons failed: ${lErr.message}`)
    }

    return json(200, {
      ok: true,
      message: 'Демо-данные созданы',
      details: {
        counts: {
          users: 1 + teacherIdsByUser.length + studentUserIds.length,
          teachers: teacherRows.length,
          students: studentRows.length,
          lessons: lessons.length
        }
      }
    })
  } catch (e) {
    console.error('[seed-demo] error', e)
    return json(500, { ok: false, message: e.message || String(e) })
  }
}