import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { createLesson, updateLesson, deleteLesson, checkLessonConflicts } from '@/lib/api'
import { formatLocalDateTimeInput, parseLocalDateTimeInput, addMinutes, toSupabaseTimestamptz } from '@/lib/datetime'

export default function EventDrawer({ open, onClose, date, teachers = [], students = [], editing = null, onSaved = () => {}, onDeleted = () => {} }) {
  const [teacherId, setTeacherId] = useState(editing?.teacher_id || teachers[0]?.id || null)
  const [studentId, setStudentId] = useState(editing?.student_id || null)
  const [title, setTitle] = useState(editing?.title || '')
  const [startAt, setStartAt] = useState(() => {
    if (editing?.start_at) return formatLocalDateTimeInput(new Date(editing.start_at))
    return formatLocalDateTimeInput(new Date(date))
  })
  const [durationMin, setDurationMin] = useState(editing?.duration_min ?? 60)
  const [status, setStatus] = useState(editing?.status || 'planned')
  const [comment, setComment] = useState(editing?.comment || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTeacherId(editing?.teacher_id || teachers[0]?.id || null)
    setStudentId(editing?.student_id || null)
    setTitle(editing?.title || '')
    setStartAt(editing?.start_at ? formatLocalDateTimeInput(new Date(editing.start_at)) : formatLocalDateTimeInput(new Date(date)))
    setDurationMin(editing?.duration_min ?? 60)
    setStatus(editing?.status || 'planned')
    setComment(editing?.comment || '')
    setError(null)
  }, [open, editing, date, teachers])

  const endDate = useMemo(() => {
    const s = parseLocalDateTimeInput(startAt)
    return addMinutes(s, durationMin || 0)
  }, [startAt, durationMin])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      if (!teacherId || !studentId) { setError('Укажите преподавателя и ученика'); return }
      const startDate = parseLocalDateTimeInput(startAt)
      const conflicts = await checkLessonConflicts(supabase, {
        teacher_id: teacherId,
        student_id: studentId,
        start_at: toSupabaseTimestamptz(startDate),
        end_at: toSupabaseTimestamptz(endDate),
        exclude_lesson_id: editing?.id || null,
      })
      if ((conflicts.teacher?.length || 0) > 0) { setError('Конфликт по времени у преподавателя'); return }
      if ((conflicts.student?.length || 0) > 0) { setError('Конфликт по времени у ученика'); return }

      const normalizedTitle = (title?.trim() || '')
      if (editing?.id) {
        const saved = await updateLesson(supabase, editing.id, { title: normalizedTitle || null, teacher_id: teacherId, student_id: studentId, start_at: toSupabaseTimestamptz(startDate), duration_min: durationMin, status, comment })
        onSaved(saved)
      } else {
        const saved = await createLesson(supabase, { title: normalizedTitle || null, teacher_id: teacherId, student_id: studentId, start_at: toSupabaseTimestamptz(startDate), duration_min: durationMin, status, comment })
        onSaved(saved)
      }
      onClose()
    } catch (e) {
      setError(typeof e?.message === 'string' ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing?.id) return
    try {
      setSaving(true)
      await deleteLesson(supabase, editing.id)
      onDeleted(editing)
      onClose()
    } catch (e) {
      setError(typeof e?.message === 'string' ? e.message : 'Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-y-0 right-0 w-96 border-l bg-white shadow-xl z-50">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{editing ? 'Редактирование урока' : 'Создание урока'}</h3>
          <button className="rounded-md p-2 hover:bg-gray-100" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>
        )}

        <label className="block text-sm">Преподаватель</label>
        <select className="w-full border rounded p-2" value={teacherId || ''} onChange={(e) => setTeacherId(e.target.value || null)}>
          <option value="">—</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.display_name ?? t.id}</option>
          ))}
        </select>

        <label className="block text-sm mt-2">Ученик</label>
        <select className="w-full border rounded p-2" value={studentId || ''} onChange={(e) => setStudentId(e.target.value || null)}>
          <option value="">—</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.display_name ?? s.id}</option>
          ))}
        </select>

        <label className="block text-sm mt-2">Название занятия</label>
        <input className="w-full border rounded p-2" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="например: Урок" />

        <label className="block text-sm mt-2">Дата и время начала</label>
        <input className="w-full border rounded p-2" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />

        <label className="block text-sm mt-2">Длительность (мин)</label>
        <input className="w-full border rounded p-2" type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value || '0', 10))} />

        <label className="block text-sm mt-2">Статус</label>
        <select className="w-full border rounded p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="planned">planned</option>
          <option value="done">done</option>
          <option value="canceled">canceled</option>
        </select>

        <label className="block text-sm mt-2">Комментарий</label>
        <textarea className="w-full border rounded p-2" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />

        <div className="flex items-center gap-2 mt-4">
          {!editing && (
            <button className="btn" onClick={handleSave} disabled={saving}>Создать</button>
          )}
          {editing && (
            <button className="btn" onClick={handleSave} disabled={saving}>Сохранить</button>
          )}
          {editing && (
            <button className="btn-outline" onClick={handleDelete} disabled={saving}>Удалить</button>
          )}
        </div>
      </div>
    </div>
  )
}