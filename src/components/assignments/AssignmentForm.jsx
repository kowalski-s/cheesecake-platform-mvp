import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
      const { data: { user } } = await supabase.auth.getUser()
      const teacher_id = user?.id
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        teacher_id,
        material_id: form.material_id || null,
      }
      const { data: inserted, error } = await supabase
        .from('assignments')
        .insert(payload)
        .select('id, title, description, due_date, teacher_id, material_id')
        .single()
      if (error) throw error

      // Если компонент используется на странице урока и передан studentId — сразу назначаем
      if (studentId && inserted?.id) {
        const row = { assignment_id: inserted.id, student_id: studentId }
        const { error: upErr } = await supabase.from('assignment_targets').upsert([row], { onConflict: 'assignment_id,student_id' })
        if (upErr) throw upErr
      }

      setToast({ type: 'success', msg: 'Задание создано' })
      setForm({ title: '', description: '', due_date: '', material_id: '' })
      if (typeof onCreated === 'function') onCreated(inserted)
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