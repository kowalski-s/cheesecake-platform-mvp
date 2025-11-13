import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'
import { getMyTeacherId, gradeSubmission } from '@/lib/api'
import toast from '@/lib/safeToast'

export function GradeModal({ visible, item, studentName, onClose, onSaved }) {
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [assignmentInfo, setAssignmentInfo] = useState(null)
  const [lessonInfo, setLessonInfo] = useState(null)
  const alreadyGraded = item?.grade != null && String(item.grade).trim() !== ''

  useEffect(() => {
    if (!visible) return
    setGrade('')
    setFeedback('')
    // Доп. загрузка описания задания и информации о занятии
    ;(async () => {
      try {
        if (item?.assignment_id) {
          const { data: aRow } = await supabase
            .from('assignments')
            .select('id, title, description, lesson_id')
            .eq('id', item.assignment_id)
            .maybeSingle()
          setAssignmentInfo(aRow || null)
          const lid = aRow?.lesson_id || item?.lesson_id || null
          if (lid) {
            const { data: lRow } = await supabase
              .from('lessons')
              .select('id, title, start_at, end_at')
              .eq('id', lid)
              .maybeSingle()
            setLessonInfo(lRow || null)
          } else {
            setLessonInfo(null)
          }
        } else {
          setAssignmentInfo(null)
          setLessonInfo(null)
        }
      } catch {}
    })()
  }, [visible, item])

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
          <div className="text-sm text-gray-600 space-y-1">
            <div className="font-medium">{assignmentInfo?.title || item.assignment_title || '—'}</div>
            {assignmentInfo?.description ? (<div>Описание: {assignmentInfo.description}</div>) : null}
            <div>Студент: {studentName || item.student_id}</div>
            <div>Сдано: {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}</div>
            {lessonInfo ? (
              <div>Занятие: {lessonInfo?.start_at ? new Date(lessonInfo.start_at).toLocaleString() : lessonInfo?.id}</div>
            ) : (
              <div>Занятие: {item.start_at ? new Date(item.start_at).toLocaleString() : item.lesson_id}</div>
            )}
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Ответ ученика</div>
              <div className="answer-text text-base text-gray-800">{item.comment || '—'}</div>
              {item.file_url ? (
                <div>
                  <a className="text-orange-600" href={item.file_url} target="_blank" rel="noreferrer">Открыть файл</a>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Файл: —</div>
              )}
            </div>
          </div>
          {!alreadyGraded && (
            <div className="grid grid-cols-1 gap-3">
              <input className="input" placeholder="Оценка (0–100)" value={grade} onChange={(e) => setGrade(e.target.value)} />
              <textarea className="input h-28" placeholder="Комментарий (необязательно)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>Отмена</button>
            {!alreadyGraded && (<button className="btn-primary" onClick={save} disabled={saving}>Сохранить</button>)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TeacherHomeworksPage() {
  const { role } = useAuth()
  const isTeacher = useMemo(() => ['teacher', 'admin'].includes((role || '').trim().toLowerCase()), [role])
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState([]) // pending
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const [count, setCount] = useState(0)
  const [studentMap, setStudentMap] = useState({})

  useEffect(() => {
    const loadPending = async () => {
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
        const sids = [...new Set((data || []).map(i => i.student_id).filter(Boolean))]
        if (sids.length) {
          const { data: studs } = await supabase
            .from('students')
            .select('id, display_name')
            .in('id', sids)
          setStudentMap(prev => ({ ...prev, ...Object.fromEntries((studs || []).map(s => [s.id, s.display_name])) }))
        }
      } catch (e) {
        console.error('ERR_LOAD_PENDING_HOMEWORKS', e)
        setError(e?.message || 'Не удалось загрузить непроверенные работы')
        setItems([])
        setCount(0)
      }
    }
    const loadReviewed = async () => {
      try {
        const teacherId = await getMyTeacherId(supabase)
        if (!teacherId) { setReviewed([]); return }
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id')
          .eq('teacher_id', teacherId)
        const lessonIds = (lessons || []).map(l => l.id)
        if (!lessonIds.length) { setReviewed([]); return }
        const { data: assigns } = await supabase
          .from('assignments')
          .select('id, title, lesson_id')
          .in('lesson_id', lessonIds)
        const aIds = (assigns || []).map(a => a.id)
        const titleByA = Object.fromEntries((assigns || []).map(a => [a.id, a.title]))
        if (!aIds.length) { setReviewed([]); return }
        const { data: subs } = await supabase
          .from('submissions')
          .select('assignment_id, student_id, grade, feedback, checked_at, created_at, file_url')
          .in('assignment_id', aIds)
          .not('grade', 'is', null)
          .order('checked_at', { ascending: false })
          .limit(20)
        const sids = [...new Set((subs || []).map(s => s.student_id).filter(Boolean))]
        let sMap = {}
        if (sids.length) {
          const { data: studs } = await supabase
            .from('students')
            .select('id, display_name')
            .in('id', sids)
          sMap = Object.fromEntries((studs || []).map(s => [s.id, s.display_name]))
        }
        const items = (subs || []).map(s => ({
          assignment_id: s.assignment_id,
          assignment_title: titleByA[s.assignment_id] || s.assignment_id,
          student_id: s.student_id,
          student_name: sMap[s.student_id] || s.student_id,
          grade: s.grade,
          feedback: s.feedback,
          checked_at: s.checked_at,
          file_url: s.file_url,
        }))
        setReviewed(items)
        setStudentMap(prev => ({ ...prev, ...sMap }))
      } catch (e) {
        console.error('ERR_LOAD_REVIEWED_HOMEWORKS', e)
      }
    }
    const boot = async () => {
      if (!isTeacher) { setLoading(false); return }
      setLoading(true)
      setError(null)
      await Promise.all([loadPending(), loadReviewed()])
      setLoading(false)
    }
    boot()
    const h = (e) => {
      const delta = (e?.detail?.countDelta ?? 0)
      if (delta !== 0) {
        loadPending();
        loadReviewed();
      }
    }
    window.addEventListener('pendingHomeworksUpdated', h)
    return () => window.removeEventListener('pendingHomeworksUpdated', h)
  }, [isTeacher])

  const onSaved = (savedItem) => {
    setItems(prev => prev.filter(i => !(i.assignment_id === savedItem.assignment_id && i.student_id === savedItem.student_id)))
    setCount(prev => Math.max(0, prev - 1))
    try { window.dispatchEvent(new CustomEvent('pendingHomeworksUpdated', { detail: { countDelta: -1 } })) } catch {}
  }

  if (!isTeacher) return <div className="card p-6 text-center">Доступ запрещён</div>
  if (loading) return <Loading message="Загрузка работ..." />

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Мои домашние задания</h2>
          <div className="inline-flex items-center rounded-xl bg-gray-50 px-2 py-1 text-sm text-gray-700 gap-2">
            <button className={`rounded-lg px-2 py-1 ${tab === 'pending' ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setTab('pending')}>Непроверенные</button>
            <button className={`rounded-lg px-2 py-1 ${tab === 'reviewed' ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setTab('reviewed')}>Проверенные</button>
          </div>
        </div>
        {tab === 'pending' ? (
          error ? (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          ) : (
            <>
              <div className="mt-2 rounded-xl bg-brand/10 px-3 py-1 text-sm text-brand">Всего: {count}</div>
              <ul className="divide-y divide-gray-100 mt-3">
                {items.map(i => (
                  <li key={`${i.assignment_id}:${i.student_id}`} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{i.assignment_title || i.assignment_id}</div>
                      <div className="text-sm text-gray-600">Студент: {studentMap[i.student_id] || i.student_id}</div>
                      <div className="text-sm text-gray-600">Сдано: {i.submitted_at ? new Date(i.submitted_at).toLocaleString() : '—'}</div>
                      <div className="text-sm text-gray-600">Урок: {i.start_at ? new Date(i.start_at).toLocaleString() : i.lesson_id}</div>
                      <div className="text-xs text-gray-500">{i.comment ? 'Есть комментарий' : 'Комментарий: —'}{i.file_url ? ' • есть файл' : ' • файл: —'}</div>
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
            </>
          )
        ) : (
          <ul className="divide-y divide-gray-100 mt-3">
            {reviewed.map(r => (
              <li key={`${r.assignment_id}:${r.student_id}`} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.assignment_title || r.assignment_id}</div>
                  <div className="text-sm text-gray-600">Студент: {r.student_name || r.student_id}</div>
                  <div className="text-sm text-gray-600">Оценка: {r.grade}</div>
                  <div className="text-xs text-gray-500">Комментарий: {(r.feedback || '—').slice(0, 140)}</div>
                  <div className="text-sm text-gray-600">Проверено: {r.checked_at ? new Date(r.checked_at).toLocaleString() : '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.file_url ? (<a className="btn-outline" href={r.file_url} target="_blank" rel="noreferrer">Открыть файл</a>) : null}
                  <button className="btn-outline" onClick={() => setModalItem({ assignment_id: r.assignment_id, student_id: r.student_id, assignment_title: r.assignment_title, file_url: r.file_url, comment: null, submitted_at: null, lesson_id: null, start_at: null, grade: r.grade, feedback: r.feedback })}>Открыть работу</button>
                </div>
              </li>
            ))}
            {reviewed.length === 0 && (
              <li className="py-8 text-center text-gray-500">Недавних проверок нет</li>
            )}
          </ul>
        )}
      </section>

      <GradeModal visible={!!modalItem} item={modalItem} studentName={modalItem ? (studentMap[modalItem.student_id] || null) : null} onClose={() => setModalItem(null)} onSaved={onSaved} />
    </div>
  )
}