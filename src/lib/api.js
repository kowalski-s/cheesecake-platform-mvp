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