import { supabase } from '@/lib/supabaseClient'

export async function getTeacherAnalytics(teacherId) {
  const empty = {
    totalLessons: 0,
    completedLessons: 0,
    upcomingLessons: 0,
    averageAttendance: null,
    totalAssignmentsGiven: 0,
    checkedAssignments: 0,
    averageGrade: null,
    lastActivityAt: null,
    gradesTimeline: [],
  }

  try {
    if (!teacherId || !supabase) return empty

    const nowIso = new Date().toISOString()

    // Lessons for teacher
    const { data: lessons, error: lessonsErr } = await supabase
      .from('lessons')
      .select('id, title, start_at, end_at')
      .eq('teacher_id', teacherId)
    if (lessonsErr) throw lessonsErr

    const totalLessons = Array.isArray(lessons) ? lessons.length : 0
    const completedLessons = (Array.isArray(lessons) ? lessons : []).filter(l => {
      try { return new Date(l.start_at).toISOString() < nowIso } catch { return false }
    }).length
    const upcomingLessons = totalLessons - completedLessons
    const teacherLessonIds = (Array.isArray(lessons) ? lessons : []).map(l => l.id)

    // Assignments by teacher across their lessons
    let assignments = []
    if (teacherLessonIds.length > 0) {
      const { data: assigns, error: assignsErr } = await supabase
        .from('assignments')
        .select('id, title, created_at, lesson_id')
        .in('lesson_id', teacherLessonIds)
      if (assignsErr) throw assignsErr
      assignments = Array.isArray(assigns) ? assigns : []
    }
    const assignmentIds = assignments.map(a => a.id)
    const totalAssignmentsGiven = assignmentIds.length

    // Submissions for those assignments
    let submissions = []
    if (assignmentIds.length > 0) {
      const { data: subs, error: subsErr } = await supabase
        .from('submissions')
        .select('id, assignment_id, student_id, grade, feedback, created_at, updated_at, student:students(display_name), assignment:assignments(title)')
        .in('assignment_id', assignmentIds)
      if (subsErr) throw subsErr
      submissions = Array.isArray(subs) ? subs : []
    }

    const checkedSubs = submissions.filter(s => s?.grade != null && String(s.grade).trim() !== '')
    const checkedAssignmentIds = new Set(checkedSubs.map(s => s.assignment_id))
    const checkedAssignments = checkedAssignmentIds.size

    // Average grade across checked submissions only (numeric)
    const numericGrades = checkedSubs
      .map(s => Number(s.grade))
      .filter(g => Number.isFinite(g))
    const averageGrade = numericGrades.length > 0
      ? Math.round((numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length) * 10) / 10
      : null

    // Grades timeline: map checked submissions to { date, grade, student, title }
    const gradesTimeline = checkedSubs
      .map(s => ({
        date: s?.updated_at || s?.created_at,
        grade: Number(s.grade),
        student: s?.student?.display_name || '—',
        title: s?.assignment?.title || '—',
      }))
      .filter(r => r.date && Number.isFinite(r.grade))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Last activity: max of past lessons.start_at, submissions.updated_at (with grade), assignments.created_at
    const lastLessonAt = (Array.isArray(lessons) ? lessons : [])
      .filter(l => {
        try { return new Date(l.start_at).toISOString() <= nowIso } catch { return false }
      })
      .reduce((max, l) => {
        const t = new Date(l.start_at).toISOString()
        return (!max || t > max) ? t : max
      }, null)
    const lastSubAt = checkedSubs
      .reduce((max, s) => {
        const t = (s?.updated_at || s?.created_at) ? new Date(s.updated_at || s.created_at).toISOString() : null
        return (!max || (t && t > max)) ? t : max
      }, null)
    const lastAssignmentAt = assignments
      .reduce((max, a) => {
        const t = a?.created_at ? new Date(a.created_at).toISOString() : null
        return (!max || (t && t > max)) ? t : max
      }, null)

    const lastActivityAt = [lastLessonAt, lastSubAt, lastAssignmentAt]
      .filter(Boolean)
      .sort((a, b) => (a > b ? -1 : 1))[0] || null

    return {
      totalLessons,
      completedLessons,
      upcomingLessons,
      averageAttendance: null,
      totalAssignmentsGiven,
      checkedAssignments,
      averageGrade,
      lastActivityAt,
      gradesTimeline,
    }
  } catch (e) {
    console.error('getTeacherAnalytics error', e, e?.stack)
    return empty
  }
}

// Статистика по ученикам конкретного преподавателя с пагинацией
// Возвращает { items: [{ studentId, studentName, lessonsWithTeacher, submittedAssignments, avgGrade, lastActivityAt }], total }
export async function getTeacherStudentsStats(teacherId, { limit = 20, offset = 0 } = {}) {
  const empty = { items: [], total: 0 }
  try {
    if (!teacherId || !supabase) return empty

    const nowIso = new Date().toISOString()

    // Все уроки преподавателя (нужны student_id и id)
    const { data: lessons, error: lessonsErr } = await supabase
      .from('lessons')
      .select('id, student_id, start_at')
      .eq('teacher_id', teacherId)
    if (lessonsErr) throw lessonsErr

    const lessonRows = Array.isArray(lessons) ? lessons : []
    const teacherLessonIds = lessonRows.map(l => l.id)
    const uniqueStudentIds = Array.from(new Set(lessonRows.map(l => l.student_id).filter(Boolean)))
    const total = uniqueStudentIds.length
    if (total === 0) return { items: [], total }

    // Пагинация по списку учеников
    const pageStudentIds = uniqueStudentIds.slice(offset, offset + limit)

    // Профили учеников для отображения имени (и user_id для fallback в users/v_users_full)
    let studentProfileById = {}
    let userInfoById = {}
    if (pageStudentIds.length > 0) {
      // Берём из той же таблицы, что используется в интерфейсе: public.students.display_name
      const { data: studentRows, error: studentErr } = await supabase
        .from('students')
        .select('id, display_name, user_id, teacher_id')
        .in('id', pageStudentIds)
        .eq('teacher_id', teacherId)
      if (studentErr) throw studentErr
      const studs = Array.isArray(studentRows) ? studentRows : []
      studentProfileById = Object.fromEntries(studs.map(s => [s.id, s]))

      // Доп. источник имени/email: public view v_users_full (id, email, display_name)
      const userIds = [...new Set(studs.map(s => s.user_id || s.id).filter(Boolean))]
      if (userIds.length > 0) {
        try {
          const { data: usersRows } = await supabase
            .from('v_users_full')
            .select('id, email, display_name')
            .in('id', userIds)
          const users = Array.isArray(usersRows) ? usersRows : []
          userInfoById = Object.fromEntries(users.map(u => [u.id, u]))
        } catch (e) {
          // Если RLS не позволяет учителю читать v_users_full — просто пропускаем, остаётся display_name из students
          userInfoById = {}
        }
      }
    }

    const computeStudentName = (studentId) => {
      const s = studentProfileById[studentId]
      const primary = (s?.display_name || '').trim()
      if (primary) return primary
      const uid = s?.user_id || studentId
      const u = userInfoById[uid]
      const secondary = (u?.display_name || '').trim()
      if (secondary) return secondary
      const email = (u?.email || '').trim()
      if (email) {
        const local = email.split('@')[0]
        if (local) return local
      }
      return 'Без имени'
    }

    // Задания преподавателя по его урокам
    let assignmentIds = []
    if (teacherLessonIds.length > 0) {
      const { data: assigns, error: assignsErr } = await supabase
        .from('assignments')
        .select('id, lesson_id')
        .in('lesson_id', teacherLessonIds)
      if (assignsErr) throw assignsErr
      assignmentIds = (Array.isArray(assigns) ? assigns : []).map(a => a.id)
    }

    // Сабмишены по заданиям этого преподавателя для выбранных учеников
    let subsRows = []
    if (assignmentIds.length > 0 && pageStudentIds.length > 0) {
      const { data: subs, error: subsErr } = await supabase
        .from('submissions')
        .select('assignment_id, student_id, grade, created_at, updated_at')
        .in('assignment_id', assignmentIds)
        .in('student_id', pageStudentIds)
      if (subsErr) throw subsErr
      subsRows = Array.isArray(subs) ? subs : []
    }

    // Агрегация по каждому ученику
    const items = pageStudentIds.map(studentId => {
      // Уроки с этим преподавателем
      const studentLessons = lessonRows.filter(l => l.student_id === studentId)
      const lessonsWithTeacher = studentLessons.length

      // Сабмишены этого ученика по заданиям данного преподавателя
      const studentSubs = subsRows.filter(s => s.student_id === studentId)

      // Уникальные выполненные ДЗ
      const submittedAssignments = (new Set(studentSubs.map(s => s.assignment_id))).size

      // Средняя оценка по сабмишенам с непустой оценкой
      const numericGrades = studentSubs
        .map(s => {
          const g = typeof s.grade === 'string' ? parseFloat(String(s.grade).replace(',', '.')) : (typeof s.grade === 'number' ? s.grade : NaN)
          return Number.isFinite(g) ? g : null
        })
        .filter(g => g !== null)
      const avgGrade = numericGrades.length > 0
        ? Math.round((numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length) * 10) / 10
        : null

      // Последняя активность: максимум из прошедших уроков и сабмишенов
      const pastLessonTimes = studentLessons
        .map(l => l?.start_at ? new Date(l.start_at).toISOString() : null)
        .filter(t => t && t <= nowIso)
      const lastLessonAt = pastLessonTimes.length > 0 ? pastLessonTimes.sort((a, b) => (a > b ? -1 : 1))[0] : null

      const subTimes = studentSubs
        .map(s => (s?.updated_at || s?.created_at) ? new Date(s.updated_at || s.created_at).toISOString() : null)
        .filter(Boolean)
      const lastSubAt = subTimes.length > 0 ? subTimes.sort((a, b) => (a > b ? -1 : 1))[0] : null

      const lastActivityAt = [lastLessonAt, lastSubAt]
        .filter(Boolean)
        .sort((a, b) => (a > b ? -1 : 1))[0] || null

      return {
        studentId,
        studentName: computeStudentName(studentId),
        lessonsWithTeacher,
        submittedAssignments,
        avgGrade,
        lastActivityAt,
      }
    })

    return { items, total }
  } catch (e) {
    console.error('getTeacherStudentsStats error', e, e?.stack)
    return empty
  }
}