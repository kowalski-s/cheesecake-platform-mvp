import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'
import toast from '@/lib/safeToast'
import { getMyStudentId, submitHomework } from '@/lib/api'

const safeText = (v) => (typeof v === 'string' && v.trim().length ? v : '—')
const HOMEWORK_BUCKET = 'homework-submissions'
const fmtDateTime = (iso) => {
  try { return iso ? new Date(iso).toLocaleString() : '—' } catch { return '—' }
}
const safeName = (name) => (name || '').replace(/[^a-zA-Z0-9._-]/g, '_')

export default function StudentAssignmentEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const isStudent = useMemo(() => (role || '').trim().toLowerCase() === 'student', [role])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [lesson, setLesson] = useState(null)
  const [myStudentId, setMyStudentId] = useState(null)
  const [submission, setSubmission] = useState(null)

  const [comment, setComment] = useState('')
  const [file, setFile] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        if (!isStudent) { setError('Доступ запрещён'); setLoading(false); return }
        setLoading(true)
        setError(null)

        const sid = await getMyStudentId(supabase)
        if (!sid) throw new Error('Нет профиля студента')
        setMyStudentId(sid)

        const { data: aRow, error: aErr } = await supabase
          .from('assignments')
          .select('id, title, description, due_date, lesson_id')
          .eq('id', id)
          .maybeSingle()
        if (aErr) throw aErr
        if (!aRow) throw new Error('Задание не найдено')
        setAssignment(aRow)

        if (aRow.lesson_id) {
          const { data: lRow } = await supabase
            .from('lessons')
            .select('id, title, start_at, end_at, duration_min')
            .eq('id', aRow.lesson_id)
            .maybeSingle()
          setLesson(lRow || null)
        } else {
          setLesson(null)
        }

        const { data: sRow } = await supabase
          .from('submissions')
          .select('assignment_id, student_id, file_url, comment, grade, feedback, checked_at, created_at')
          .eq('assignment_id', id)
          .eq('student_id', sid)
          .maybeSingle()
        setSubmission(sRow || null)
        setComment(sRow?.comment || '')
        setFile(null)
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить редактор ДЗ')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isStudent])

  const hasGrade = !!(submission && submission.grade !== null && submission.grade !== undefined && String(submission.grade).trim() !== '')
  const readOnly = hasGrade

  const handleSave = async () => {
    try {
      if (!myStudentId || !assignment?.id) return
      let fileUrl = submission?.file_url || null
      if (file) {
        const path = `private/${myStudentId}/${assignment.id}-${Date.now()}-${safeName(file.name)}`
        const up = await supabase.storage.from(HOMEWORK_BUCKET).upload(path, file, { upsert: true })
        if (up.error) throw up.error
        const { data: pub } = supabase.storage.from(HOMEWORK_BUCKET).getPublicUrl(path)
        fileUrl = pub?.publicUrl || path
      }
      const { error: upErr } = await submitHomework(supabase, {
        assignmentId: assignment.id,
        studentId: myStudentId,
        fileUrl,
        comment,
      })
      if (upErr) throw upErr
      const created = !submission
      toast.success(created ? 'Домашка отправлена' : 'Домашка сохранена')
      navigate('/assignments/student')
      return
    } catch (e) {
      toast.error(e?.message || 'Не удалось сохранить работу')
    }
  }

  if (!isStudent) return <div className="card p-6 text-center">Доступ запрещён</div>
  if (loading) return <Loading message="Загрузка редактора…" />
  if (error) return <div className="card p-6 text-center text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">Задание</h2>
        <div className="font-medium">{safeText(assignment?.title)}</div>
        <div className="text-sm text-gray-600">{safeText(assignment?.description)}</div>
        <div className="text-sm text-gray-600">Срок: {assignment?.due_date ? fmtDateTime(assignment?.due_date) : 'без срока'}</div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Занятие</h2>
        {lesson ? (
          <div className="text-sm text-gray-600">{fmtDateTime(lesson?.start_at)}{lesson?.end_at ? ` — ${fmtDateTime(lesson.end_at)}` : ''}</div>
        ) : (
          <div className="text-sm text-gray-500">Задание не привязано к конкретному занятию</div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Ответ ученика</h2>
        {submission?.file_url ? (
          <div className="text-sm">
            Файл: <a className="text-orange-600" href={submission.file_url} target="_blank" rel="noreferrer">открыть</a>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Файл: —</div>
        )}
        <textarea className="input h-28" placeholder="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} readOnly={readOnly} />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={readOnly} />

        {hasGrade ? (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Проверено • оценка: {submission?.grade ?? '—'}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={handleSave}>Сохранить</button>
            <button className="btn-outline" onClick={() => navigate(-1)}>Назад</button>
          </div>
        )}
      </section>

      {(submission && (hasGrade || submission?.feedback)) && (
        <section className="card space-y-2">
          <h2 className="text-lg font-semibold">Комментарий преподавателя</h2>
          <div className="text-sm text-gray-800 whitespace-pre-wrap">{safeText(submission?.feedback)}</div>
        </section>
      )}
    </div>
  )
}