import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/ui/Loading'
import toast from '@/lib/safeToast'

export default function AdminStudentsPage() {
  const { role } = useAuth()
  const isAdmin = useMemo(() => role === 'admin', [role])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // student object
  const [form, setForm] = useState({ display_name: '', teacher_id: '', remaining_lessons: 0, user_id: '' })
  const [users, setUsers] = useState([]) // candidates for binding (students)
  const [teachers, setTeachers] = useState([])
  

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured || !supabase) {
        setError('Supabase не настроен')
        return
      }
      let query = supabase.from('students').select('id, display_name, teacher_id, remaining_lessons, user_id, teacher:teachers(id, display_name)').order('display_name')
      if (search) query = query.ilike('display_name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      const base = data || []

      // Fetch active subscription info by user_id
      const ids = base.map(s => s.user_id || s.id).filter(Boolean)
      let subsMap = {}
      if (ids.length) {
        const { data: subs, error: subsErr } = await supabase
          .from('subscriptions')
          .select('id, user_id, remaining_lessons, active, created_at')
          .in('user_id', ids)
          .eq('active', true)
        if (subsErr) throw subsErr
        (subs || []).forEach(x => { subsMap[x.user_id] = x })
      }

      // Pull user email/display_name from public view v_users_full
      const userIds = [...new Set(base.map(s => s.user_id).filter(Boolean))]
      let userInfoById = {}
      if (userIds.length) {
        const { data: usersInfo, error: usersErr } = await supabase
          .from('v_users_full')
          .select('id, email, display_name')
          .in('id', userIds)
        if (usersErr) throw usersErr
        (usersInfo || []).forEach(u => { userInfoById[u.id] = u })
      }

      const merged = base.map(s => {
        const sub = subsMap[s.user_id || s.id]
        const uinfo = s.user_id ? userInfoById[s.user_id] : null
        const created = sub?.created_at ? new Date(sub.created_at) : null
        const endAt = created ? new Date(created.getTime() + 30*24*3600*1000) : null
        const daysLeft = endAt ? Math.ceil((endAt.getTime() - Date.now()) / (24*3600*1000)) : null
        return {
          ...s,
          remaining_effective: (sub?.remaining_lessons ?? s.remaining_lessons ?? 0),
          subscription_end_days: daysLeft,
          user_display_name: uinfo?.display_name || null,
          user_email: uinfo?.email || null,
        }
      })
      setItems(merged)
    } catch (e) {
      console.error('load students failed', e)
      setError(e?.message || 'Не удалось загрузить учеников')
    } finally {
      setLoading(false)
    }
  }

  const loadLists = async () => {
    try {
      const [{ data: ts, error: tErr }, { data: us, error: uErr }] = await Promise.all([
        supabase.from('teachers').select('id, display_name').order('display_name'),
        supabase.from('v_users_full').select('id, email, display_name').eq('role', 'student').order('display_name').limit(50)
      ])
      if (tErr) throw tErr
      if (uErr) throw uErr
      setTeachers(ts || [])
      setUsers(us || [])
    } catch (e) {
      console.error('load lists failed', e)
      toast.error(e?.message || 'Ошибка загрузки списков')
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, page, pageSize])
  useEffect(() => { loadLists(); }, [])

  const startCreate = () => {
    setEditing({ id: null })
    setForm({ display_name: '', teacher_id: '', remaining_lessons: 0, user_id: '' })
  }
  const startEdit = (s) => {
    setEditing(s)
    setForm({ display_name: s.display_name || '', teacher_id: s.teacher_id || '', remaining_lessons: s.remaining_lessons || 0, user_id: s.user_id || '' })
  }
  const cancelEdit = () => { setEditing(null) }
  const save = async () => {
    try {
      if (!isAdmin) return
      if (!form.display_name.trim()) { toast.error('Введите имя'); return }
      const payload = { display_name: form.display_name.trim(), teacher_id: form.teacher_id || null, remaining_lessons: Number(form.remaining_lessons) || 0, user_id: form.user_id || null }
      if (editing?.id) {
        const { error } = await supabase
          .from('students')
          .update({ ...payload, user_id: payload.user_id || editing.id })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        if (!form.user_id) { toast.error('При создании задайте user_id (id = user_id)'); return }
        const { error } = await supabase
          .from('students')
          .insert({ id: form.user_id, ...payload })
        if (error) throw error
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
      const { error } = await supabase.from('students').update({ user_id: userId || null }).eq('id', id)
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
        <h1 className="text-2xl font-semibold">Ученики</h1>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Преподаватель</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Осталось</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">До абонемента</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">user_id</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(s => (
                <tr key={s.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      <Link className="text-orange-600" to={`/admin/students/${s.id}`}>{s.display_name}</Link>
                    </div>
                    <div className="text-xs text-gray-400">{s.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    {s.teacher?.id ? (
                      <Link className="text-orange-600" to={`/admin/teachers/${s.teacher.id}`}>{s.teacher?.display_name}</Link>
                    ) : (
                      s.teacher?.display_name || 'Не назначен'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${ (s.remaining_effective ?? 0) < 14 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800' }`}>
                      {s.remaining_effective ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${ (s.subscription_end_days ?? Infinity) < 14 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800' }`}>
                      {typeof s.subscription_end_days === 'number' ? `${s.subscription_end_days} дн.` : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {s.user_id ? (
                      <div>
                        <div className="text-sm text-gray-700">{s.user_display_name || s.user_id}</div>
                        {s.user_email && <div className="text-xs text-gray-500">{s.user_email}</div>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select className="input" onChange={(e) => bindInline(s.id, e.target.value)} defaultValue="">
                          <option value="">Выбрать...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="btn-outline" onClick={() => startEdit(s)}>Редактировать</button>
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
              <h3 className="text-lg font-semibold">{editing.id ? 'Редактировать ученика' : 'Создать ученика'}</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Имя</label>
                <input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Преподаватель</label>
                <select className="input" value={form.teacher_id || ''} onChange={(e) => setForm({ ...form, teacher_id: e.target.value || null })}>
                  <option value="">Не назначен</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Осталось занятий</label>
                <input type="number" className="input" value={form.remaining_lessons} onChange={(e) => setForm({ ...form, remaining_lessons: Number(e.target.value) || 0 })} />
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