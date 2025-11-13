import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GradeModal } from './TeacherHomeworks'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import CreateAndAssignModal from '@/components/assignments/CreateAndAssignModal'
import { submitHomework, gradeSubmission } from '@/lib/api'

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

function SelectAssignmentModal({ visible, onClose, onAssigned, teacherId, studentId }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const loadAssignments = async () => {
      if (!visible) return
      setLoading(true)
      setError(null)
      try {
        let q = supabase.from('assignments').select('id, title, due_date').order('created_at', { ascending: false })
        if (teacherId) q = q.eq('teacher_id', teacherId)
        const { data, error: aErr } = await q
        if (aErr) throw aErr
        setAssignments(data || [])
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить задания')
      } finally {
        setLoading(false)
      }
    }
    loadAssignments()
  }, [visible, teacherId])

  const confirmAssign = async () => {
    try {
      if (!selectedId || !studentId) { setToast({ type: 'error', msg: 'Выберите задание' }); return }
      const rows = [{ assignment_id: selectedId, student_id: studentId }]
      const { error: upErr } = await supabase.from('assignment_targets').upsert(rows, { onConflict: 'assignment_id,student_id', returning: 'minimal' })
      if (upErr) throw upErr
      setToast({ type: 'success', msg: 'Задание назначено' })
      setTimeout(() => setToast(null), 2000)
      if (typeof onAssigned === 'function') onAssigned({ assignment_id: selectedId, student_id: studentId })
      if (typeof onClose === 'function') onClose()
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось назначить' })
      setTimeout(() => setToast(null), 2500)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Выберите задание</h3>
          {loading ? (
            <div className="text-sm text-gray-500">Загрузка…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {assignments.map(a => (
                <li key={a.id} className="py-2 flex items-center justify-between">
                  <label className="flex items-center gap-3">
                    <input type="radio" name="assignment" value={a.id} onChange={() => setSelectedId(a.id)} />
                    <span className="font-medium">{a.title}</span>
                  </label>
                  <span className="text-xs text-gray-500">{a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}</span>
                </li>
              ))}
              {assignments.length === 0 && <li className="py-4 text-center text-sm text-gray-500">Нет заданий</li>}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>Отмена</button>
            <button className="btn-primary" onClick={confirmAssign}>Назначить</button>
          </div>
        </div>
        {toast && (
          <div className={`absolute -top-8 right-4 rounded-xl px-3 py-1 text-sm shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
        )}
      </div>
    </div>
  )
}

export default function LessonPage() {
  const { id } = useParams()
  const { role } = useAuth()
  const normalizedRole = useMemo(() => (role || '').trim().toLowerCase(), [role])
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [userId, setUserId] = useState(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [assignments, setAssignments] = useState([])
  const [subsByAssign, setSubsByAssign] = useState({})
  const [commentByAssign, setCommentByAssign] = useState({})
  const [fileByAssign, setFileByAssign] = useState({})
  const [gradeByAssign, setGradeByAssign] = useState({})
  const [feedbackByAssign, setFeedbackByAssign] = useState({})
  const [showOnlyPending, setShowOnlyPending] = useState(true)
  const [modalItem, setModalItem] = useState(null)

  const HOMEWORK_BUCKET = 'homework-submissions'

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
        const path = `private/${lesson.student_id}/${a.id}-${Date.now()}-${safeName(file.name)}`
        const up = await supabase.storage.from(HOMEWORK_BUCKET).upload(path, file, { upsert: true })
        if (up.error) throw up.error
        const { data: pub } = supabase.storage.from(HOMEWORK_BUCKET).getPublicUrl(path)
        fileUrl = pub?.publicUrl || path
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
      setToast({ type: 'success', msg: 'Работа отправлена' })
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось отправить работу' })
      setTimeout(() => setToast(null), 2500)
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
      setToast({ type: 'success', msg: 'Оценка сохранена' })
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось сохранить оценку' })
      setTimeout(() => setToast(null), 2500)
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
            <button className="btn-primary" onClick={() => setAssignOpen(true)}>Назначить ДЗ</button>
          </div>
        )}
        {canGrade && (
          <div className="mt-3 inline-flex items-center rounded-xl bg-gray-50 px-2 py-1 text-sm text-gray-700 gap-2">
            <button className={`rounded-lg px-2 py-1 ${showOnlyPending ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setShowOnlyPending(true)}>Непроверенные</button>
            <button className={`rounded-lg px-2 py-1 ${!showOnlyPending ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setShowOnlyPending(false)}>Все</button>
          </div>
        )}
      </section>

      <SelectAssignmentModal
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => { setToast({ type: 'success', msg: 'ДЗ назначено' }); refreshAssignments(); }}
        teacherId={lesson.teacher_id}
        studentId={lesson.student_id}
      />

      <CreateAndAssignModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setToast({ type: 'success', msg: 'ДЗ создано' }); refreshAssignments(); }}
        teacherId={lesson.teacher_id}
        studentId={lesson.student_id}
        lessonId={lesson.id}
      />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast?.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast?.msg}</div>
      )}

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