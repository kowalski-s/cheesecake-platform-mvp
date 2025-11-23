import { supabase } from '@/lib/supabaseClient'

export async function inviteUser({ email, display_name, role }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch('/.netlify/functions/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, display_name, role }),
  })
  let data = null
  try { data = await res.json() } catch {}
  return { ok: res.ok, status: res.status, data }
}

// Унифицированная утилита: получить id ученика по текущему пользователю
// Использует переданный клиент supabase (sb), чтобы работать в любом окружении
export async function getMyStudentId(sb) {
  try {
    const { data: authRes, error: authErr } = await sb.auth.getUser()
    if (authErr) throw authErr
    const uid = authRes?.user?.id
    if (!uid) return null

    const { data, error } = await sb
      .from('students')
      .select('id')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.id ?? null
  } catch (e) {
    // Прокидываем наверх, чтобы страница могла отобразить безопасные заглушки
    throw e
  }
}

// Получить id преподавателя по текущему пользователю
export async function getMyTeacherId(sb) {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data, error } = await sb
    .from('teachers')
    .select('id, display_name')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

// Отправить домашнюю работу (upsert по паре assignment_id+student_id)
export async function submitHomework(sb, { assignmentId, studentId, fileUrl, comment }) {
  return sb
    .from('submissions')
    .upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      file_url: fileUrl ?? null,
      comment: comment ?? null,
    }, { onConflict: 'assignment_id,student_id', returning: 'minimal' })
}

// Проверить работу: поставить оценку, комментарий и отметить checked_at
export async function gradeSubmission(sb, { assignmentId, studentId, grade, feedback }) {
  return sb
    .from('submissions')
    .update({
      grade,
      feedback: feedback ?? null,
      checked_at: new Date().toISOString(),
    })
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
}

// ===== Lessons API helpers =====
// Fetch lessons by date range and teacher ids (inclusive)
export async function fetchLessons(sb, { start, end, teacherIds = [] }) {
  let q = sb
    .from('lessons')
    .select('id, title, start_at, end_at, duration_min, status, comment, teacher_id, student_id, student:students(id, display_name), teacher:teachers(id, display_name)')
    .gte('start_at', start)
    .lt('start_at', end)

  if (Array.isArray(teacherIds) && teacherIds.length > 0) {
    q = q.in('teacher_id', teacherIds)
  }
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createLesson(sb, { title = null, class_name = null, start_at, end_at = null, duration_min = null, status = 'planned', comment = null, teacher_id, student_id }) {
  const payload = { title, start_at, status, comment, teacher_id, student_id }
  if (class_name) payload.class_name = class_name
  if (end_at) payload.end_at = end_at
  if (duration_min != null) payload.duration_min = duration_min
  const { data, error } = await sb
    .from('lessons')
    .insert(payload)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateLesson(sb, id, patch) {
  const { data, error } = await sb
    .from('lessons')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteLesson(sb, id) {
  const { error } = await sb
    .from('lessons')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}

// Check for conflicts for teacher and student within [start_at, end_at)
export async function checkLessonConflicts(sb, { teacher_id, student_id, start_at, end_at, exclude_lesson_id = null }) {
  const conditions = []
  const overlaps = (q) => q.or(
    [
      // existing.start < end && existing.end > start
      `start_at.lt.${end_at},end_at.gt.${start_at}`,
      // if end_at is null, use duration_min
    ].join(',')
  )

  // Teacher conflicts
  let tq = sb.from('lessons').select('id, start_at, end_at, duration_min').eq('teacher_id', teacher_id)
  if (exclude_lesson_id) tq = tq.neq('id', exclude_lesson_id)
  tq = overlaps(tq)
  const tRes = await tq

  // Student conflicts
  let sq = sb.from('lessons').select('id, start_at, end_at, duration_min').eq('student_id', student_id)
  if (exclude_lesson_id) sq = sq.neq('id', exclude_lesson_id)
  sq = overlaps(sq)
  const sRes = await sq

  const tErr = tRes.error, sErr = sRes.error
  if (tErr) throw tErr
  if (sErr) throw sErr
  const teacherConflicts = tRes.data || []
  const studentConflicts = sRes.data || []

  // Also check duration_min-only entries (end_at null) overlap on client side
  const toEnd = (row) => row.end_at ? new Date(row.end_at).getTime() : new Date(row.start_at).getTime() + ((row.duration_min || 0) * 60000)
  const startMs = new Date(start_at).getTime()
  const endMs = new Date(end_at).getTime()
  const overlapsClient = (row) => {
    const s = new Date(row.start_at).getTime()
    const e = toEnd(row)
    return s < endMs && e > startMs
  }

  return {
    teacher: teacherConflicts.filter(overlapsClient),
    student: studentConflicts.filter(overlapsClient),
  }
}