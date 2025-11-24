import { supabase } from '@/lib/supabaseClient'

// Получить метрики и таймлайн оценок для ученика (без фильтрации по периоду, для обратной совместимости)
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

/**
 * Получить расширенную аналитику студента с фильтрацией по периоду
 * @param {string} studentId - ID студента
 * @param {object} options - { from, to } - ISO строки дат или null
 * @returns {object} - метрики за период
 */
export async function getStudentAnalyticsByPeriod(studentId, { from = null, to = null } = {}) {
  if (!studentId) throw new Error('studentId is required')
  
  const empty = {
    lessonsTotal: 0,
    completedLessons: 0,
    plannedLessons: 0,
    canceledLessons: 0,
    totalAssignments: 0,
    completedAssignments: 0,
    onTimeAssignments: 0, // Своевременно сданные ДЗ
    averageGrade: null,
    lastActivityAt: null,
    submissionsCount: 0,
    gradesTimeline: [],
    lessonsList: [],
    assignmentsList: [],
  }

  try {
    if (!supabase) return empty

    // Уроки студента с фильтрацией по периоду
    let lessonsQuery = supabase
      .from('lessons')
      .select('id, title, start_at, end_at, status, class_name, teacher:teachers(id, display_name)')
      .eq('student_id', studentId)
    
    if (from) {
      lessonsQuery = lessonsQuery.gte('start_at', from)
    }
    if (to) {
      lessonsQuery = lessonsQuery.lte('start_at', to)
    }
    
    const { data: lessons, error: lessonsErr } = await lessonsQuery
    if (lessonsErr) throw lessonsErr

    const lessonsArray = Array.isArray(lessons) ? lessons : []
    const completedLessons = lessonsArray.filter(l => l.status === 'done').length
    const plannedLessons = lessonsArray.filter(l => l.status === 'planned').length
    const canceledLessons = lessonsArray.filter(l => l.status === 'canceled').length
    const totalLessons = lessonsArray.length

    // Получаем ID заданий, назначенных студенту
    const { data: assignmentTargets } = await supabase
      .from('assignment_targets')
      .select('assignment_id')
      .eq('student_id', studentId)

    const assignmentIds = Array.isArray(assignmentTargets) 
      ? [...new Set(assignmentTargets.map(at => at.assignment_id))] 
      : []

    // Задания с фильтрацией по дате создания (если период задан)
    let assignmentsQuery = supabase
      .from('assignments')
      .select('id, title, created_at, due_date, teacher:teachers(display_name)')
      .in('id', assignmentIds.length > 0 ? assignmentIds : ['00000000-0000-0000-0000-000000000000'])

    if (from) {
      assignmentsQuery = assignmentsQuery.gte('created_at', from)
    }
    if (to) {
      assignmentsQuery = assignmentsQuery.lte('created_at', to)
    }

    const { data: assignments, error: assignsErr } = await assignmentsQuery
    if (assignsErr) throw assignsErr

    const assignmentsArray = Array.isArray(assignments) ? assignments : []
    const totalAssignments = assignmentsArray.length

    // Сабмишены студента по этим заданиям
    const assignmentIdsForSubs = assignmentsArray.map(a => a.id)
    let submissionsQuery = supabase
      .from('submissions')
      .select('id, assignment_id, grade, created_at, updated_at')
      .eq('student_id', studentId)
      .in('assignment_id', assignmentIdsForSubs.length > 0 ? assignmentIdsForSubs : ['00000000-0000-0000-0000-000000000000'])

    if (from) {
      submissionsQuery = submissionsQuery.gte('created_at', from)
    }
    if (to) {
      submissionsQuery = submissionsQuery.lte('created_at', to)
    }

    const { data: submissions, error: subsErr } = await submissionsQuery
    if (subsErr) throw subsErr

    const submissionsArray = Array.isArray(submissions) ? submissions : []
    const completedAssignments = new Set(submissionsArray.map(s => s.assignment_id)).size
    const submissionsCount = submissionsArray.length

    // Своевременно сданные ДЗ (до дедлайна)
    const now = new Date()
    const onTimeAssignments = assignmentsArray.filter(assign => {
      if (!assign.due_date) return false
      const submission = submissionsArray.find(s => s.assignment_id === assign.id)
      if (!submission) return false
      const submittedAt = new Date(submission.created_at || submission.updated_at)
      const dueDate = new Date(assign.due_date)
      return submittedAt <= dueDate
    }).length

    // Средняя оценка за период
    const grades = submissionsArray
      .map(s => {
        const g = typeof s.grade === 'string' ? parseFloat(s.grade.replace(',', '.')) : (typeof s.grade === 'number' ? s.grade : NaN)
        return Number.isFinite(g) ? g : null
      })
      .filter(g => g !== null)

    const averageGrade = grades.length > 0
      ? Math.round((grades.reduce((acc, v) => acc + v, 0) / grades.length) * 10) / 10
      : null

    // Таймлайн оценок
    const gradesTimeline = submissionsArray
      .filter(s => s.grade != null)
      .map(s => {
        const assign = assignmentsArray.find(a => a.id === s.assignment_id)
        const dateIso = (s.updated_at || s.created_at) ? new Date(s.updated_at || s.created_at).toISOString() : null
        const gradeNum = typeof s.grade === 'string' ? parseFloat(s.grade.replace(',', '.')) : (typeof s.grade === 'number' ? s.grade : null)
        return {
          date: dateIso,
          grade: gradeNum,
          title: assign?.title || 'Без названия',
          lessonDate: null // Можно добавить связь с уроком если нужно
        }
      })
      .filter(item => item.date && Number.isFinite(item.grade))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Последняя активность
    const lastLessonAt = lessonsArray.length > 0
      ? lessonsArray
          .filter(l => l.start_at && new Date(l.start_at) <= now)
          .sort((a, b) => new Date(b.start_at) - new Date(a.start_at))[0]?.start_at
      : null

    const lastSubAt = submissionsArray.length > 0
      ? submissionsArray
          .map(s => s.updated_at || s.created_at)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0]
      : null

    const lastActivityAt = [lastLessonAt, lastSubAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    // Формируем списки для таблиц
    const lessonsList = lessonsArray.map(l => ({
      id: l.id,
      date: l.start_at,
      title: l.title || '—',
      class_name: l.class_name || '—',
      teacher: l.teacher?.display_name || '—',
      status: l.status,
      grade: null, // Оценка за урок (если есть в БД)
      assignmentStatus: null, // Статус ДЗ (будет вычисляться на фронте)
    }))

    const assignmentsList = assignmentsArray.map(a => {
      const submission = submissionsArray.find(s => s.assignment_id === a.id)
      const isOnTime = submission && a.due_date 
        ? new Date(submission.created_at || submission.updated_at) <= new Date(a.due_date)
        : false
      const isOverdue = a.due_date && (!submission || new Date(submission.created_at || submission.updated_at) > new Date(a.due_date))
      
      let status = 'not_submitted'
      if (submission) {
        status = isOnTime ? 'completed' : 'overdue'
      }

      return {
        id: a.id,
        title: a.title || '—',
        lessonDate: null, // Можно добавить связь с уроком
        dueDate: a.due_date,
        status,
        grade: submission?.grade || null,
      }
    })

    return {
      lessonsTotal: totalLessons,
      completedLessons,
      plannedLessons,
      canceledLessons,
      totalAssignments,
      completedAssignments,
      onTimeAssignments,
      averageGrade,
      lastActivityAt,
      submissionsCount,
      gradesTimeline,
      lessonsList,
      assignmentsList,
    }
  } catch (e) {
    console.error('getStudentAnalyticsByPeriod error', e)
    return empty
  }
}
