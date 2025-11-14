import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/ui/Loading'
import toast from '@/lib/safeToast'

export default function AdminTeachersPage() {
  const { role } = useAuth()
  const isAdmin = useMemo(() => role === 'admin', [role])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // teacher object
  const [form, setForm] = useState({ display_name: '', bio: '', user_id: '' })
  const [users, setUsers] = useState([]) // candidates for binding

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured || !supabase) {
        setError('Supabase не настроен')
        return
      }
      let query = supabase.from('teachers').select('id, display_name, bio, user_id').order('display_name')
      if (search) query = query.ilike('display_name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      const base = data || []

      // Pull user email/display_name from public view v_users_full
      const userIds = [...new Set(base.map(t => t.user_id).filter(Boolean))]
      let userInfoById = {}
      if (userIds.length) {
        const { data: usersInfo, error: usersErr } = await supabase
          .from('v_users_full')
          .select('id, email, display_name')
          .in('id', userIds)
        if (usersErr) throw usersErr
        (usersInfo || []).forEach(u => { userInfoById[u.id] = u })
      }

      const merged = base.map(t => ({
        ...t,
        user_display_name: t.user_id ? userInfoById[t.user_id]?.display_name || null : null,
        user_email: t.user_id ? userInfoById[t.user_id]?.email || null : null,
      }))
      setItems(merged)
    } catch (e) {
      console.error('load teachers failed', e)
      setError(e?.message || 'Не удалось загрузить преподавателей')
    } finally {
      setLoading(false)
    }
  }

  const loadRoleUsers = async (term = '') => {
    try {
      const { data, error } = await supabase
        .from('v_users_full')
        .select('id, email, display_name')
        .eq('role', 'teacher')
        .order('display_name')
        .limit(50)
      if (error) throw error
      setUsers(data || [])
    } catch (e) {
      console.error('admin_list_role_users failed', e)
      toast.error(e?.message || 'Ошибка загрузки пользователей')
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, page, pageSize])
  useEffect(() => { loadRoleUsers(''); }, [])

  const startCreate = () => {
    setEditing({ id: null })
    setForm({ display_name: '', bio: '', user_id: '' })
  }
  const startEdit = (t) => {
    setEditing(t)
    setForm({ display_name: t.display_name || '', bio: t.bio || '', user_id: t.user_id || '' })
  }
  const cancelEdit = () => { setEditing(null) }
  const save = async () => {
    try {
      if (!isAdmin) return
      if (!form.display_name.trim()) { toast.error('Введите имя'); return }
      if (editing?.id) {
        const { error } = await supabase
          .from('teachers')
          .update({ display_name: form.display_name.trim(), bio: form.bio || null, user_id: form.user_id || null })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        // Ручной upsert по user_id: если запись существует, делаем update, иначе insert
        let existing = null
        if (form.user_id) {
          const { data: ex } = await supabase.from('teachers').select('id').eq('user_id', form.user_id).maybeSingle()
          existing = ex || null
        }
        if (existing?.id) {
          const { error } = await supabase
            .from('teachers')
            .update({ display_name: form.display_name.trim(), bio: form.bio || null, user_id: form.user_id || null })
            .eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('teachers')
            .insert({ display_name: form.display_name.trim(), bio: form.bio || null, user_id: form.user_id || null })
          if (error) throw error
        }
      }
      toast.success('Сохранено')
      setEditing(null)
      await load()
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase()
      const isUnique = msg.includes('duplicate') || msg.includes('unique')
      toast.error(isUnique ? 'Этот пользователь уже привязан' : (e?.message || 'Ошибка сохранения'))
    }
  }

  const bindInline = async (id, userId) => {
    try {
      const { error } = await supabase.from('teachers').update({ user_id: userId || null }).eq('id', id)
      if (error) throw error
      toast.success('Привязано')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Не удалось привязать')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Преподаватели</h1>
        <button className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white" onClick={startCreate}>Добавить</button>
      </div>
      <div className="card">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Поиск</label>
            <input className="input" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value) }} placeholder="имя" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Размер страницы</label>
            <select className="input" value={pageSize} onChange={(e) => { setPage(0); setPageSize(Number(e.target.value) || 20) }}>
              {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button className="btn-outline" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Назад</button>
            <button className="btn-outline" onClick={() => setPage(page + 1)}>Вперёд</button>
          </div>
        </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">user_id</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(t => (
                <tr key={t.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      <Link className="text-orange-600" to={`/admin/teachers/${t.id}`}>{t.display_name}</Link>
                    </div>
                    <div className="text-xs text-gray-500">{t.bio}</div>
                    <div className="text-xs text-gray-400">{t.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    {t.user_id ? (
                      <div>
                        <div className="text-sm text-gray-700">{t.user_display_name || t.user_id}</div>
                        {t.user_email && <div className="text-xs text-gray-500">{t.user_email}</div>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select className="input" onChange={(e) => bindInline(t.id, e.target.value)} defaultValue="">
                          <option value="">Выбрать...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="btn-outline" onClick={() => startEdit(t)}>Редактировать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
            <button onClick={cancelEdit} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">{editing.id ? 'Редактировать преподавателя' : 'Создать преподавателя'}</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Имя</label>
                <input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea className="input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">user_id (привязка)</label>
                <select className="input" value={form.user_id || ''} onChange={(e) => setForm({ ...form, user_id: e.target.value || null })}>
                  <option value="">Не привязан</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={cancelEdit}>Отмена</button>
                <button className="btn-primary" onClick={save} disabled={!isAdmin}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}