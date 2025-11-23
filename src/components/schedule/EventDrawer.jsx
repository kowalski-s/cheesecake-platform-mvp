import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { createLesson, updateLesson, deleteLesson, checkLessonConflicts } from '@/lib/api'
import { formatLocalDateTimeInput, parseLocalDateTimeInput, addMinutes, toSupabaseTimestamptz } from '@/lib/datetime'

export default function EventDrawer({ open, onClose, date, teachers = [], students = [], editing = null, initialStartAt = null, initialDurationMin = null, onSaved = () => {}, onDeleted = () => {} }) {
  const [teacherId, setTeacherId] = useState(editing?.teacher_id || teachers[0]?.id || null)
  const [studentId, setStudentId] = useState(editing?.student_id || null)
  const [title, setTitle] = useState(editing?.title || '')
  const [className, setClassName] = useState(editing?.class_name || '')
  const [startAt, setStartAt] = useState(() => {
    if (editing?.start_at) return formatLocalDateTimeInput(new Date(editing.start_at))
    if (initialStartAt) return formatLocalDateTimeInput(new Date(initialStartAt))
    return formatLocalDateTimeInput(new Date(date))
  })
  const [durationMin, setDurationMin] = useState(editing?.duration_min ?? (initialDurationMin ?? 60))
  const [status, setStatus] = useState(editing?.status || 'planned')
  const [comment, setComment] = useState(editing?.comment || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTeacherId(editing?.teacher_id || teachers[0]?.id || null)
    setStudentId(editing?.student_id || null)
    setTitle(editing?.title || '')
    setClassName(editing?.class_name || '')
    if (editing?.start_at) {
      setStartAt(formatLocalDateTimeInput(new Date(editing.start_at)))
    } else if (initialStartAt) {
      setStartAt(formatLocalDateTimeInput(new Date(initialStartAt)))
    } else {
      setStartAt(formatLocalDateTimeInput(new Date(date)))
    }
    setDurationMin(editing?.duration_min ?? (initialDurationMin ?? 60))
    setStatus(editing?.status || 'planned')
    setComment(editing?.comment || '')
    setError(null)
  }, [open, editing, date, teachers, initialStartAt, initialDurationMin])

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
      const normalizedClassName = (className?.trim() || null)
      if (editing?.id) {
        const saved = await updateLesson(supabase, editing.id, { title: normalizedTitle || null, class_name: normalizedClassName, teacher_id: teacherId, student_id: studentId, start_at: toSupabaseTimestamptz(startDate), duration_min: durationMin, status, comment })
        onSaved(saved)
      } else {
        const saved = await createLesson(supabase, { title: normalizedTitle || null, class_name: normalizedClassName, teacher_id: teacherId, student_id: studentId, start_at: toSupabaseTimestamptz(startDate), duration_min: durationMin, status, comment })
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
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 z-40" 
        onClick={onClose}
      ></div>
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? 'Редактирование урока' : 'Создание урока'}</h3>
              <button className="rounded-md p-2 hover:bg-gray-100" onClick={onClose} aria-label="Закрыть">✕</button>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Преподаватель</label>
              <select className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" value={teacherId || ''} onChange={(e) => setTeacherId(e.target.value || null)}>
                <option value="">—</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.display_name ?? t.id}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ученик</label>
              <select className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" value={studentId || ''} onChange={(e) => setStudentId(e.target.value || null)}>
                <option value="">—</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.display_name ?? s.id}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название занятия</label>
              <input className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="например: Урок" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата и время начала</label>
              <input className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Длительность (мин)</label>
              <input className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value || '0', 10))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Класс / Уровень</label>
              <input className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="например: HSK1" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="planned">Запланировано</option>
                <option value="done">Проведено</option>
                <option value="canceled">Отменено</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
              <textarea className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>

            <div className="flex items-center gap-2 pt-2">
              {!editing && (
                <button className="flex-1 rounded-xl px-4 py-2 bg-brand text-white hover:bg-brand-muted font-medium transition-colors disabled:opacity-50" onClick={handleSave} disabled={saving}>Создать</button>
              )}
              {editing && (
                <>
                  <button className="flex-1 rounded-xl px-4 py-2 bg-brand text-white hover:bg-brand-muted font-medium transition-colors disabled:opacity-50" onClick={handleSave} disabled={saving}>Сохранить</button>
                  <button className="rounded-xl px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50" onClick={handleDelete} disabled={saving}>Удалить</button>
                </>
              )}
              <button className="rounded-xl px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors" onClick={onClose}>Отмена</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}