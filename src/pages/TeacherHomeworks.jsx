import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'
import { getMyTeacherId, gradeSubmission } from '@/lib/api'
import toast from '@/lib/safeToast'

function GradeModal({ visible, item, onClose, onSaved }) {
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    setGrade('')
    setFeedback('')
  }, [visible])

  if (!visible || !item) return null

  const save = async () => {
    const num = Number(grade)
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      toast.error('Оценка должна быть в диапазоне 0–100')
      return
    }
    try {
      setSaving(true)
      const { error } = await gradeSubmission(supabase, {
        assignmentId: item.assignment_id,
        studentId: item.student_id,
        grade: String(num),
        feedback: feedback || null,
      })
      if (error) throw error
      if (typeof onSaved === 'function') onSaved(item)
      toast.success('Оценка сохранена')
      onClose()
    } catch (e) {
      toast.error(e?.message || 'Не удалось сохранить оценку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Проверка работы</h3>
          <div className="text-sm text-gray-600">
            <div className="font-medium">{item.assignment_title || '—'}</div>
            <div>Студент: {item.student_id}</div>
            <div>Сдано: {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}</div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <input className="input" placeholder="Оценка (0–100)" value={grade} onChange={(e) => setGrade(e.target.value)} />
            <input className="input" placeholder="Комментарий (необязательно)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>Отмена</button>
            <button className="btn-primary" onClick={save} disabled={saving}>Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TeacherHomeworksPage() {
  const { role } = useAuth()
  const isTeacher = useMemo(() => ['teacher', 'admin'].includes((role || '').trim().toLowerCase()), [role])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      if (!isTeacher) { setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        const teacherId = await getMyTeacherId(supabase)
        if (!teacherId) { setItems([]); setCount(0); return }
        const { data, error, count } = await supabase
          .from('v_teacher_pending_submissions')
          .select('assignment_id, student_id, file_url, comment, submitted_at, assignment_title, lesson_id, start_at', { count: 'exact' })
          .order('submitted_at', { ascending: false })
        if (error) throw error
        setItems(data || [])
        setCount(count ?? 0)
      } catch (e) {
        console.error('ERR_LOAD_TEACHER_HOMEWORKS', e)
        setError(e?.message || 'Не удалось загрузить непроверенные работы')
        setItems([])
        setCount(0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isTeacher])

  const onSaved = (savedItem) => {
    setItems(prev => prev.filter(i => !(i.assignment_id === savedItem.assignment_id && i.student_id === savedItem.student_id)))
    setCount(prev => Math.max(0, prev - 1))
    try { window.dispatchEvent(new CustomEvent('pendingHomeworksUpdated', { detail: { countDelta: -1 } })) } catch {}
  }

  if (!isTeacher) return <div className="card p-6 text-center">Доступ запрещён</div>
  if (loading) return <Loading message="Загрузка непроверенных работ..." />

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Непроверенные работы</h2>
          <div className="rounded-xl bg-brand/10 px-3 py-1 text-sm text-brand">Всего: {count}</div>
        </div>
        {error ? (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        ) : (
          <ul className="divide-y divide-gray-100 mt-3">
            {items.map(i => (
              <li key={`${i.assignment_id}:${i.student_id}`} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{i.assignment_title || i.assignment_id}</div>
                  <div className="text-sm text-gray-600">Студент: {i.student_id}</div>
                  <div className="text-sm text-gray-600">Сдано: {i.submitted_at ? new Date(i.submitted_at).toLocaleString() : '—'}</div>
                  <div className="text-sm text-gray-600">Урок: {i.start_at ? new Date(i.start_at).toLocaleString() : i.lesson_id}</div>
                </div>
                <div className="flex items-center gap-2">
                  {i.file_url ? (<a className="btn-outline" href={i.file_url} target="_blank" rel="noreferrer">Открыть файл</a>) : null}
                  <button className="btn-primary" onClick={() => setModalItem(i)}>Проверить</button>
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <li className="py-8 text-center text-gray-500">Нет непроверенных работ</li>
            )}
          </ul>
        )}
      </section>

      <GradeModal visible={!!modalItem} item={modalItem} onClose={() => setModalItem(null)} onSaved={onSaved} />
    </div>
  )
}