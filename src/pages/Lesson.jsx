import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GradeModal } from './TeacherHomeworks'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import CreateAndAssignModal from '@/components/assignments/CreateAndAssignModal'
import { submitHomework, gradeSubmission } from '@/lib/api'
import toast from '@/lib/safeToast'

const safeText = (v) => (typeof v === 'string' && v.trim().length ? v : '—')
const fmtDateTime = (iso) => {
  try { return iso ? new Date(iso).toLocaleString() : '—' } catch { return '—' }
}
const statusFromSubmission = (s) => {
  if (!s) return { label: 'не сдано', color: 'bg-gray-50 text-gray-700' }
  const hasGrade = s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
  if (hasGrade) return { label: `проверено (оценка: ${s.grade})`, color: 'bg-green-50 text-green-700' }
  return { label: 'ожидает проверки', color: 'bg-yellow-50 text-yellow-700' }
}

// [MVP simplification] Отключено: модалка выбора ДЗ из «хранилища»
// function SelectAssignmentModal({ visible, onClose, onAssigned, teacherId, studentId }) { /* disabled for MVP */ }

export default function LessonPage() {
  const { id } = useParams()
  const { role } = useAuth()
  const normalizedRole = useMemo(() => (role || '').trim().toLowerCase(), [role])
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  // const [assignOpen, setAssignOpen] = useState(false) // disabled for MVP
  const [createOpen, setCreateOpen] = useState(false)
  const [assignments, setAssignments] = useState([])
  const [subsByAssign, setSubsByAssign] = useState({})
  const [commentByAssign, setCommentByAssign] = useState({})
  const [fileByAssign, setFileByAssign] = useState({})
  const [gradeByAssign, setGradeByAssign] = useState({})
  const [feedbackByAssign, setFeedbackByAssign] = useState({})
  const [showOnlyPending, setShowOnlyPending] = useState(true)
  const [modalItem, setModalItem] = useState(null)

  const HOMEWORK_BUCKET = 'submissions'

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        setUserId(user?.id || null)
        const { data, error: qErr } = await supabase
          .from('lessons')
          .select('id, title, class_name, start_at, status, notes, teacher_id, student_id, teacher:teachers(id, display_name), student:students(id, display_name)')
          .eq('id', id)
          .limit(1)
        if (qErr) throw qErr
        const l = (data || [])[0] || null
        if (!l) throw new Error('Урок не найден')
        setLesson(l)

        // Задания урока: пробуем view v_lesson_assignments, иначе fallback на assignments
        let list = []
        const viewSel = await supabase
          .from('v_lesson_assignments')
          .select('assignment_id, title, description, due_date, created_at, lesson_id')
          .eq('lesson_id', id)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
        if (!viewSel.error) {
          list = (viewSel.data || []).map(r => ({
            id: r.assignment_id,
            title: r.title,
            description: r.description,
            due_date: r.due_date,
            created_at: r.created_at,
            lesson_id: r.lesson_id,
          }))
        } else {
          const { data: a2, error: a2err } = await supabase
            .from('assignments')
            .select('id, title, description, due_date, created_at, lesson_id')
            .eq('lesson_id', id)
            .order('due_date', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false })
          if (a2err) throw a2err
          list = a2 || []
        }
        setAssignments(list)

        // Сабмишны ученика по этим заданиям
        const ids = list.map(a => a.id)
        if (ids.length) {
          let q = supabase
            .from('submissions')
            .select('assignment_id, student_id, file_url, comment, grade, feedback, checked_at, created_at, student:students(id, display_name)')
            .in('assignment_id', ids)
          // Для студента — только его сабмишены, для преподавателя — все по уроку
          const isTeacher = normalizedRole === 'teacher' || normalizedRole === 'admin'
          if (!isTeacher) q = q.eq('student_id', l.student_id)
          const { data: subs, error: sErr } = await q
          if (sErr) throw sErr
          const map = {}
          ;(subs || []).forEach(s => { if (!(s.assignment_id in map)) map[s.assignment_id] = s })
          setSubsByAssign(map)
        } else {
          setSubsByAssign({})
        }
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить урок')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Перезагрузка списка заданий и сабмишенов без полного рефреша страницы
  const refreshAssignments = async () => {
    try {
      if (!lesson?.id) return
      // Задания урока
      let list = []
      const viewSel = await supabase
        .from('v_lesson_assignments')
        .select('assignment_id, title, description, due_date, created_at, lesson_id')
        .eq('lesson_id', lesson.id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (!viewSel.error) {
        list = (viewSel.data || []).map(r => ({ id: r.assignment_id, title: r.title, description: r.description, due_date: r.due_date, created_at: r.created_at, lesson_id: r.lesson_id }))
      } else {
        const { data: a2 } = await supabase
          .from('assignments')
          .select('id, title, description, due_date, created_at, lesson_id')
          .eq('lesson_id', lesson.id)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
        list = a2 || []
      }
      setAssignments(list)

      // Сабмишны
      const ids = list.map(a => a.id)
      if (ids.length) {
        let q = supabase
          .from('submissions')
          .select('assignment_id, student_id, file_url, comment, grade, feedback, checked_at, created_at')
          .in('assignment_id', ids)
        const isTeacher = normalizedRole === 'teacher' || normalizedRole === 'admin'
        if (!isTeacher) q = q.eq('student_id', lesson.student_id)
        const { data: subs } = await q
        const map = {}
        ;(subs || []).forEach(s => { if (!(s.assignment_id in map)) map[s.assignment_id] = s })
        setSubsByAssign(map)
      } else {
        setSubsByAssign({})
      }
    } catch (e) {
      // silent
    }
  }

  const canAssign = useMemo(() => {
    if (!lesson) return false
    return normalizedRole === 'admin' || (normalizedRole === 'teacher' && userId && userId === lesson.teacher_id)
  }, [lesson, normalizedRole, userId])

  const canSubmit = useMemo(() => normalizedRole === 'student' && !!lesson?.student_id, [normalizedRole, lesson])
  const canGrade = useMemo(() => (normalizedRole === 'teacher' || normalizedRole === 'admin') && !!lesson?.teacher_id && userId === lesson?.teacher_id, [normalizedRole, lesson, userId])

  const handleSubmit = async (a) => {
    try {
      if (!lesson?.student_id) return
      const file = fileByAssign[a.id]
      const comment = commentByAssign[a.id] || null
      let fileUrl = null
      if (file) {
        const safeName = (name) => (name || '').replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${lesson.student_id}/${a.id}-${Date.now()}-${safeName(file.name)}`
        const up = await supabase.storage.from(HOMEWORK_BUCKET).upload(path, file, { upsert: true })
        if (up.error) throw up.error
        const { data } = supabase.storage.from(HOMEWORK_BUCKET).getPublicUrl(path)
        fileUrl = data?.publicUrl || null
      }
      const { error } = await submitHomework(supabase, { assignmentId: a.id, studentId: lesson.student_id, fileUrl, comment })
      if (error) throw error
      // Обновим сабмишн для задания
      const { data: subsData } = await supabase
        .from('submissions')
        .select('assignment_id, student_id, file_url, comment, grade, feedback, checked_at, created_at')
        .eq('assignment_id', a.id)
        .eq('student_id', lesson.student_id)
        .maybeSingle()
      setSubsByAssign(prev => ({ ...prev, [a.id]: subsData || null }))
      setCommentByAssign(prev => ({ ...prev, [a.id]: '' }))
      setFileByAssign(prev => ({ ...prev, [a.id]: null }))
      toast.success('Работа отправлена')
    } catch (e) {
      toast.error(e?.message || 'Не удалось отправить работу')
    }
  }

  // Обновление страницы урока при глобальном событии из TeacherHomeworks
  useEffect(() => {
    const onPendingUpdated = () => {
      refreshAssignments()
    }
    window.addEventListener('pendingHomeworksUpdated', onPendingUpdated)
    return () => window.removeEventListener('pendingHomeworksUpdated', onPendingUpdated)
  }, [lesson?.id])

  const handleGrade = async (a) => {
    try {
      const grade = gradeByAssign[a.id]
      const feedback = feedbackByAssign[a.id]
      const { error } = await gradeSubmission(supabase, { assignmentId: a.id, studentId: lesson.student_id, grade, feedback })
      if (error) throw error
      const { data: subsData } = await supabase
        .from('submissions')
        .select('assignment_id, student_id, file_url, comment, grade, feedback, checked_at, created_at')
        .eq('assignment_id', a.id)
        .eq('student_id', lesson.student_id)
        .maybeSingle()
      setSubsByAssign(prev => ({ ...prev, [a.id]: subsData || null }))
      toast.success('Оценка сохранена')
    } catch (e) {
      toast.error(e?.message || 'Не удалось сохранить оценку')
    }
  }

  if (loading) return <div className="card p-6 text-center">Загрузка…</div>
  if (error) return <div className="card p-6 text-center text-red-600">{error}</div>
  if (!lesson) return <div className="card p-6 text-center">Нет данных</div>

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-xl font-semibold mb-1">{lesson.title}</h1>
        <div className="text-sm text-gray-600 mb-4">
          {new Date(lesson.start_at).toLocaleString()} • статус: {lesson.status} • класс: {lesson.class_name || '—'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><span className="text-gray-500">Преподаватель:</span> <span className="font-medium">{lesson.teacher?.display_name || lesson.teacher_id}</span></div>
          <div><span className="text-gray-500">Ученик:</span> <span className="font-medium">{lesson.student?.display_name || lesson.student_id}</span></div>
        </div>
        {canAssign && (
          <div className="mt-4 flex items-center gap-2">
            <button className="btn-outline" onClick={() => setCreateOpen(true)}>Создать ДЗ</button>
            {/* Кнопка «Назначить ДЗ» отключена для MVP */}
          </div>
        )}
        {canGrade && (
          <div className="mt-3 inline-flex items-center rounded-xl bg-gray-50 px-2 py-1 text-sm text-gray-700 gap-2">
            <button className={`rounded-lg px-2 py-1 ${showOnlyPending ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setShowOnlyPending(true)}>Непроверенные</button>
            <button className={`rounded-lg px-2 py-1 ${!showOnlyPending ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setShowOnlyPending(false)}>Все</button>
          </div>
        )}
      </section>

      {/* Отключено: выбор из хранилища
      <SelectAssignmentModal
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => { toast.success('ДЗ назначено'); refreshAssignments(); }}
        teacherId={lesson.teacher_id}
        studentId={lesson.student_id}
      />
      */}

      <CreateAndAssignModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { toast.success('ДЗ создано'); refreshAssignments(); }}
        teacherId={lesson.teacher_id}
        studentId={lesson.student_id}
        lessonId={lesson.id}
      />

      

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Задания урока</h2>
        <ul className="divide-y divide-gray-100">
          {(canGrade && showOnlyPending ? assignments.filter(a => {
            const sFilter = subsByAssign[a.id] || null
            return !!sFilter && (sFilter.grade == null || String(sFilter.grade).trim() === '')
          }) : assignments).map(a => {
            const s = subsByAssign[a.id] || null
            const st = statusFromSubmission(s)
            return (
              <li key={a.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{safeText(a.title)}</div>
                    <div className="text-sm text-gray-500">{safeText(a.description)}</div>
                    <div className="text-sm text-gray-500">Срок: {a.due_date ? fmtDateTime(a.due_date) : 'без срока'}</div>
                  </div>
                  <span className={`rounded-xl px-3 py-1 text-sm ${st.color}`}>{st.label}</span>
                </div>

                {s && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      {s.file_url ? (<a className="text-orange-600" href={s.file_url} target="_blank" rel="noreferrer">Файл</a>) : 'Файл: —'}
                      {' • '}отправлено: {fmtDateTime(s.created_at)}
                    </div>
                    <div>Комментарий: {safeText(s.comment)}</div>
                  </div>
                )}

                {canSubmit && (
                  <div className="flex items-center gap-3">
                    {!s && (
                      <a className="btn-outline" href={`/student/assignments/${a.id}`}>Отправить ДЗ</a>
                    )}
                    {s && (s.grade == null || String(s.grade).trim() === '') && (
                      <a className="btn-outline" href={`/student/assignments/${a.id}`}>Редактировать отправку</a>
                    )}
                    {s && s.grade != null && String(s.grade).trim() !== '' && (
                      <a className="btn-outline" href={`/student/assignments/${a.id}`}>Посмотреть комментарий преподавателя</a>
                    )}
                  </div>
                )}

                {canGrade && (
                  <div className="flex items-center gap-3">
                    {(!s) ? null : ((s.grade == null || String(s.grade).trim() === '') ? (
                      <button className="btn-primary" onClick={() => setModalItem({ assignment_id: a.id, student_id: lesson.student_id, file_url: s.file_url, comment: s.comment, submitted_at: s.created_at, assignment_title: a.title, lesson_id: lesson.id, start_at: lesson.start_at })}>
                        Проверить
                      </button>
                    ) : (
                      <button className="btn-outline" onClick={() => setModalItem({ assignment_id: a.id, student_id: lesson.student_id, file_url: s.file_url, comment: s.comment, submitted_at: s.created_at, assignment_title: a.title, lesson_id: lesson.id, start_at: lesson.start_at, grade: s.grade, feedback: s.feedback })}>
                        Открыть работу
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
          {assignments.length === 0 && (
            <li className="py-8 text-center text-gray-500">Для этого урока пока нет заданий</li>
          )}
        </ul>
      </section>

      <GradeModal
        visible={!!modalItem}
        item={modalItem}
        studentName={lesson?.student?.display_name || null}
        onClose={() => setModalItem(null)}
        onSaved={() => { setModalItem(null); refreshAssignments(); }}
      />
    </div>
  )
}