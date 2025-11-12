import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getMyTeacherId } from '@/lib/api'

export default function AssignmentForm({ onCreated, studentId }) {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', material_id: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('materials')
          .select('id, title, file_type, class_name, visibility, owner_id')
          .order('created_at', { ascending: false })
        setMaterials(data || [])
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить материалы')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (!form.title.trim()) { setToast({ type: 'error', msg: 'Введите название' }); return }
      const teacher_id = await getMyTeacherId(supabase)
      if (!teacher_id) { setToast({ type: 'error', msg: 'Не найден профиль преподавателя' }); return }
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        teacher_id,
        material_id: (form.material_id || '').trim() ? form.material_id : null,
      }
      const { error: insErr } = await supabase
        .from('assignments')
        .insert(payload, { returning: 'minimal' })
      if (insErr) throw insErr

      // Получаем assignment_id отдельным разрешённым SELECT
      const { data: created, error: selErr } = await supabase
        .from('assignments')
        .select('id')
        .eq('teacher_id', teacher_id)
        .eq('title', payload.title)
        .is('lesson_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (selErr) throw selErr
      const assignmentId = created?.id

      // Если компонент используется на странице урока и передан studentId — сразу назначаем
      if (studentId && assignmentId) {
        const row = { assignment_id: assignmentId, student_id: studentId }
        const { error: upErr } = await supabase.from('assignment_targets').insert(row, { returning: 'minimal' })
        if (upErr) throw upErr
      }

      setToast({ type: 'success', msg: 'Задание создано' })
      setForm({ title: '', description: '', due_date: '', material_id: '' })
      if (typeof onCreated === 'function') onCreated({ id: assignmentId })
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось создать задание' })
    } finally {
      setTimeout(() => setToast(null), 2500)
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Создать задание</h2>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Название</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Описание</label>
          <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
                <option key={m.id} value={m.id}>{m.title || '—'} ({m.file_type || 'unknown'})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-primary">Создать</button>
        </div>
      </form>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
      {loading && <div className="mt-2 text-sm text-gray-500">Загрузка материалов…</div>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </section>
  )
}