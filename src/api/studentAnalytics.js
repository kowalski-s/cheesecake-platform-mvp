import { supabase } from '@/lib/supabaseClient'

// Получить метрики и таймлайн оценок для ученика
// Возвращает объект:
// {
//   lessonsTotal, lessonsLeft, completedLessons, progressPercent,
//   totalAssignments, completedAssignments,
//   averageGrade,
//   lastActivityAt,
//   gradesTimeline: [{ date, grade, title }]
// }
export async function getStudentAnalytics(studentId) {
  if (!studentId) throw new Error('studentId is required')
  const nowIso = new Date().toISOString()

  // Активный абонемент (может отсутствовать)
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('id, lessons_total, lessons_left, remaining_lessons')
    .eq('active', true)
    .eq('student_id', studentId)
    .maybeSingle()

  // Количество уникальных заданий, назначенных ученику (assignment_targets)
  const { data: atRows, error: atErr } = await supabase
    .from('assignment_targets')
    .select('assignment_id')
    .eq('student_id', studentId)

  if (atErr) throw atErr
  const totalAssignments = Array.isArray(atRows) ? (new Set(atRows.map(r => r.assignment_id)).size) : 0

  // Количество уникальных выполненных заданий (по наличию сабмишена)
  const { data: subRows, error: subErr } = await supabase
    .from('submissions')
    .select('assignment_id')
    .eq('student_id', studentId)

  if (subErr) throw subErr
  let completedAssignments = Array.isArray(subRows) ? (new Set(subRows.map(r => r.assignment_id)).size) : 0
  // completed не должен превышать total
  completedAssignments = Math.min(completedAssignments, totalAssignments)

  // Последняя активность: максимум из прошедшего урока (start_at <= now) и последнего сабмишна
  const { data: lastLessonRow } = await supabase
    .from('lessons')
    .select('start_at')
    .eq('student_id', studentId)
    .lte('start_at', nowIso)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: lastSubmissionRow } = await supabase
    .from('submissions')
    .select('updated_at, created_at')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastLessonAt = lastLessonRow?.start_at ? new Date(lastLessonRow.start_at).getTime() : null
  const lastSubAtRaw = lastSubmissionRow?.updated_at || lastSubmissionRow?.created_at || null
  const lastSubAt = lastSubAtRaw ? new Date(lastSubAtRaw).getTime() : null
  const lastActivityAtTs = Math.max(lastLessonAt || 0, lastSubAt || 0)
  const lastActivityAt = lastActivityAtTs > 0 ? new Date(lastActivityAtTs).toISOString() : null

  // Средняя оценка: берём все оценки, парсим в число, игнорируем нечисловые
  const { data: gradeRows } = await supabase
    .from('submissions')
    .select('grade')
    .eq('student_id', studentId)

  const grades = (gradeRows || [])
    .map(r => {
      const g = typeof r.grade === 'string' ? parseFloat(r.grade.replace(',', '.')) : (typeof r.grade === 'number' ? r.grade : NaN)
      return Number.isFinite(g) ? g : null
    })
    .filter(g => g !== null)

  const averageGrade = grades.length > 0
    ? Math.round((grades.reduce((acc, v) => acc + v, 0) / grades.length) * 10) / 10
    : null

  // Таймлайн оценок: submissions с оценкой + join к assignments для title
  const { data: timelineRows } = await supabase
    .from('submissions')
    .select('grade, created_at, updated_at, assignments:assignments(title)')
    .eq('student_id', studentId)
    .not('grade', 'is', null)
    .order('updated_at', { ascending: true })

  const gradesTimeline = (timelineRows || []).map(r => {
    const title = r?.assignments?.title || 'Без названия'
    const dateIso = (r?.updated_at || r?.created_at) ? new Date(r.updated_at || r.created_at).toISOString() : null
    const gradeNum = typeof r.grade === 'string' ? parseFloat(r.grade.replace(',', '.')) : (typeof r.grade === 'number' ? r.grade : null)
    return { date: dateIso, grade: gradeNum, title }
  }).filter(item => item.date && Number.isFinite(item.grade))

  // Метрики «Уроки» на основе абонемента (поддержка lessons_left/remaining_lessons)
  const lessonsTotal = activeSub?.lessons_total ?? 0
  const lessonsLeft = activeSub?.lessons_left ?? activeSub?.remaining_lessons ?? 0
  const completedLessons = Math.max(0, lessonsTotal > 0 ? (lessonsTotal - lessonsLeft) : 0)
  const progressPercent = lessonsTotal > 0 ? Math.min(100, Math.round((completedLessons / lessonsTotal) * 100)) : 0

  return {
    lessonsTotal,
    lessonsLeft,
    completedLessons,
    progressPercent,
    totalAssignments,
    completedAssignments,
    averageGrade,
    lastActivityAt,
    gradesTimeline,
  }
}