import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import Loading from '../components/ui/Loading'

export default function AdminMaterialsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', storage_path: '' })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured || !supabase) {
        setError('Supabase не настроен')
        return
      }
      const { data, error } = await supabase.from('materials').select('id, title, description, storage_path, created_at').order('created_at', { ascending: false })
      if (error) throw error
      setItems(data || [])
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить материалы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const startCreate = () => { setEditing({ id: null }); setForm({ title: '', description: '', storage_path: '' }) }
  const startEdit = (m) => { setEditing(m); setForm({ title: m.title || '', description: m.description || '', storage_path: m.storage_path || '' }) }
  const cancel = () => { setEditing(null) }

  const isValidPath = (p) => typeof p === 'string' && p.length > 3 && /\S/.test(p)

  const save = async () => {
    try {
      if (!form.title.trim()) { setToast({ type: 'error', msg: 'Введите название' }); return }
      if (!isValidPath(form.storage_path)) { setToast({ type: 'error', msg: 'Укажите путь в хранилище (storage_path)' }); return }
      const payload = { title: form.title.trim(), description: form.description || null, storage_path: form.storage_path.trim() }
      if (editing?.id) {
        const { error } = await supabase.from('materials').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const owner_id = user?.id || null
        const { error } = await supabase.from('materials').insert({ ...payload, owner_id })
        if (error) throw error
      }
      setToast({ type: 'success', msg: 'Сохранено' })
      setEditing(null)
      await load()
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Ошибка сохранения' })
    }
  }

  const remove = async (id) => {
    try {
      const { error } = await supabase.from('materials').delete().eq('id', id)
      if (error) throw error
      setToast({ type: 'success', msg: 'Удалено' })
      await load()
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Ошибка удаления' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Материалы</h1>
        <button className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white" onClick={startCreate}>Добавить</button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="card p-4 text-center text-red-600">{error}</div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Путь</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создано</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(m => (
                <tr key={m.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{m.title || '—'}</div>
                    <div className="text-xs text-gray-500">{m.description || '—'}</div>
                  </td>
                  <td className="px-6 py-4"><code className="text-xs">{m.storage_path}</code></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{m.created_at ? new Date(m.created_at).toLocaleString() : '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="btn-outline mr-2" onClick={() => startEdit(m)}>Редактировать</button>
                    <button className="btn-outline" onClick={() => remove(m.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Материалы не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
            <button onClick={cancel} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">{editing.id ? 'Редактировать материал' : 'Создать материал'}</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Название</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Путь в хранилище (storage_path)</label>
                <input className="input" value={form.storage_path} onChange={(e) => setForm({ ...form, storage_path: e.target.value })} placeholder="public/materials/file.pdf" />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={cancel}>Отмена</button>
                <button className="btn-primary" onClick={save}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
    </div>
  )
}