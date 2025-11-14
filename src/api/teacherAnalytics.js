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