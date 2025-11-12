import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getMyTeacherId } from '@/lib/api'

export default function CreateAndAssignModal({ visible, onClose, teacherId, studentId, lessonId, onCreated }) {
  const [materials, setMaterials] = useState([])
  const [form, setForm] = useState({ title: '', description: '', due_date: '', material_id: '', assignNow: true })
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const loadMaterials = async () => {
      if (!visible) return
      setLoading(true)
      setError(null)
      try {
        // Загружаем материалы только владельца-преподавателя (owner_id = teacherId)
        const { data, error: mErr } = await supabase
          .from('materials')
          .select('id, title, storage_path, created_at')
          .eq('owner_id', teacherId)
          .order('created_at', { ascending: false })
        if (mErr) throw mErr
        setMaterials(data || [])
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить материалы')
      } finally {
        setLoading(false)
      }
    }
    loadMaterials()
  }, [visible, teacherId])

  const submit = async () => {
    try {
      if (!form.title.trim()) { setToast({ type: 'error', msg: 'Введите название' }); return }
      setSubmitting(true)
      setToast(null)
      const myTeacherId = await getMyTeacherId(supabase)
      if (!myTeacherId) { setToast({ type: 'error', msg: 'Не найден профиль преподавателя' }); return }
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        teacher_id: myTeacherId,
        ...(lessonId ? { lesson_id: lessonId } : {}),
        material_id: (form.material_id || '').trim() ? form.material_id : null,
      }
      const { error: insErr } = await supabase
        .from('assignments')
        .insert(payload, { returning: 'minimal' })
      if (insErr) throw insErr

      // Отдельный SELECT, чтобы получить id созданного задания (без нарушения RLS)
      let q = supabase
        .from('assignments')
        .select('id')
        .eq('teacher_id', myTeacherId)
        .eq('title', payload.title)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!lessonId) {
        q = supabase
          .from('assignments')
          .select('id')
          .eq('teacher_id', myTeacherId)
          .eq('title', payload.title)
          .is('lesson_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      } else {
        q = supabase
          .from('assignments')
          .select('id')
          .eq('teacher_id', myTeacherId)
          .eq('title', payload.title)
          .eq('lesson_id', lessonId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      }
      const { data: created, error: selErr } = await q
      if (selErr) throw selErr
      const assignmentId = created?.id

      // Если нужно сразу назначить текущему ученику
      if (form.assignNow && studentId && assignmentId) {
        const row = { assignment_id: assignmentId, student_id: studentId }
        const { error: upErr } = await supabase
          .from('assignment_targets')
          .insert(row, { returning: 'minimal' })
        if (upErr) throw upErr
      }

      setToast({ type: 'success', msg: 'Задание создано' })
      if (typeof onCreated === 'function') onCreated({ id: assignmentId })
      setTimeout(() => setToast(null), 2000)
      if (typeof onClose === 'function') onClose()
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось создать' })
      setTimeout(() => setToast(null), 2500)
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Создать и назначить ДЗ</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">Название</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">Описание</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Дедлайн</label>
                <input type="datetime-local" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Материал</label>
                <select className="input" value={form.material_id} onChange={(e) => setForm({ ...form, material_id: e.target.value })}>
                  <option value="">Без материала</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.title || m.storage_path || m.id}</option>
                  ))}
                </select>
                {loading && <div className="mt-1 text-xs text-gray-500">Загрузка материалов…</div>}
                {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.assignNow} onChange={(e) => setForm({ ...form, assignNow: e.target.checked })} />
              <span className="text-sm text-gray-700">Сразу назначить этому ученику</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose} disabled={submitting}>Отмена</button>
            <button className="btn-primary" onClick={submit} disabled={submitting}>Создать</button>
          </div>
        </div>
        {toast && (
          <div className={`absolute -top-8 right-4 rounded-xl px-3 py-1 text-sm shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
        )}
      </div>
    </div>
  )
}