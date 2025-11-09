import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import CreateAndAssignModal from '@/components/assignments/CreateAndAssignModal'

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
      const { error: upErr } = await supabase.from('assignment_targets').upsert(rows, { onConflict: 'assignment_id,student_id' })
      if (upErr) throw upErr
      setToast({ type: 'success', msg: 'Задание назначено' })
      setTimeout(() => setToast(null), 2000)
      onAssigned?.({ assignment_id: selectedId, student_id: studentId })
      onClose?.()
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
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить урок')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const canAssign = useMemo(() => {
    if (!lesson) return false
    return normalizedRole === 'admin' || (normalizedRole === 'teacher' && userId && userId === lesson.teacher_id)
  }, [lesson, normalizedRole, userId])

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
      </section>

      <SelectAssignmentModal
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => setToast({ type: 'success', msg: 'ДЗ назначено' })}
        teacherId={lesson.teacher_id}
        studentId={lesson.student_id}
      />

      <CreateAndAssignModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setToast({ type: 'success', msg: 'ДЗ создано' })}
        teacherId={lesson.teacher_id}
        studentId={lesson.student_id}
      />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast?.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast?.msg}</div>
      )}
    </div>
  )
}