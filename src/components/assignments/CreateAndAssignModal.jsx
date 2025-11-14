import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getMyTeacherId } from '@/lib/api'
import toast from '@/lib/safeToast'

export default function CreateAndAssignModal({ visible, onClose, teacherId, studentId, lessonId, onCreated }) {
  const [materials, setMaterials] = useState([])
  const [form, setForm] = useState({ title: '', description: '', due_date: '', material_id: '' })
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
      if (!form.title.trim()) { toast.error('Введите название'); return }
      setSubmitting(true)
      const myTeacherId = await getMyTeacherId(supabase)
      if (!myTeacherId) { toast.error('Не найден профиль преподавателя'); return }
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

      // Автоматически назначаем ДЗ текущему ученику урока
      if (studentId && assignmentId) {
        const row = { assignment_id: assignmentId, student_id: studentId }
        const { error: upErr } = await supabase
          .from('assignment_targets')
          .insert(row, { returning: 'minimal' })
        if (upErr) throw upErr
      }

      toast.success('Задание создано')
      if (typeof onCreated === 'function') onCreated({ id: assignmentId })
      if (typeof onClose === 'function') onClose()
    } catch (e) {
      toast.error(e?.message || 'Не удалось создать')
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
          <h3 className="text-lg font-semibold">Создать ДЗ</h3>
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
            {/* Назначение выполняется автоматически для текущего ученика урока (MVP) */}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose} disabled={submitting}>Отмена</button>
            <button className="btn-primary" onClick={submit} disabled={submitting}>Создать</button>
          </div>
        </div>
      </div>
    </div>
  )
}