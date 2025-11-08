import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/ui/Loading'
import InviteUserModal from '../components/InviteUserModal'

export default function AdminUsersPage() {
  const { role } = useAuth()
  const isAdmin = useMemo(() => role === 'admin', [role])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [createForm, setCreateForm] = useState({ email: '', role: 'student' })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured || !supabase) {
        setError('Supabase не настроен')
        return
      }
      const { data, error } = await supabase.rpc('admin_list_users', {
        p_search: search || null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      })
      if (error) throw error
      setUsers(data || [])
    } catch (e) {
      console.error('admin_list_users failed', e)
      setError(e?.message || 'Не удалось загрузить пользователей')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, pageSize])

  const changeRole = async (userId, newRole) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/.netlify/functions/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'update_role', user_id: userId, role: newRole }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) throw new Error(body?.error || `Update role failed (${res.status})`)
      setToast({ type: 'success', msg: 'Роль обновлена' })
      await load()
    } catch (e) {
      console.error('update_role failed', e)
      setToast({ type: 'error', msg: `Не удалось изменить роль: ${e?.message || 'неизвестная ошибка'}` })
    }
  }

  const createUser = async () => {
    try {
      const email = createForm.email.trim()
      const role = createForm.role.trim()
      if (!email || !role) { setToast({ type: 'error', msg: 'Введите email и роль' }); return }
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/.netlify/functions/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'create', email, role }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) throw new Error(body?.error || `Create failed (${res.status})`)
      setToast({ type: 'success', msg: `Создан: ${body?.data?.email} (${body?.data?.role})` })
      setCreateForm({ email: '', role: 'student' })
      await load()
    } catch (e) {
      console.error('create user failed', e)
      setToast({ type: 'error', msg: `Создание не удалось: ${e?.message || 'неизвестная ошибка'}` })
    }
  }

  const deleteUser = async (userId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/.netlify/functions/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'delete', user_id: userId }),
      })
      const ok = res.ok
      if (!ok) {
        const msg = await res.text().catch(() => null)
        setToast({ type: 'error', msg: `Удаление не удалось${msg ? `: ${msg}` : ''}` })
        return
      }
      setToast({ type: 'success', msg: 'Пользователь удалён' })
      await load()
    } catch (e) {
      console.error('delete user failed', e)
      setToast({ type: 'error', msg: `Удаление не удалось: ${e?.message || 'неизвестная ошибка'}` })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Пользователи</h1>
        <button className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white" onClick={() => setInviteOpen(true)}>Пригласить</button>
      </div>
      <div className="card">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Поиск</label>
            <input className="input" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value) }} placeholder="email/имя/роль" />
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
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Email (создать)</label>
            <input className="input" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="user@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Роль</label>
            <select className="input" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={createUser} disabled={!isAdmin}>Создать пользователя</button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Связки</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{u.email || '—'}</div>
                    <div className="text-xs text-gray-400">{u.id}</div>
                  </td>
                  <td className="px-6 py-4">{u.display_name || '—'}</td>
                  <td className="px-6 py-4">
                    <select className="input" value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} disabled={!isAdmin}>
                      <option value="student">student</option>
                      <option value="teacher">teacher</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {u.teacher_id ? <span className="mr-2">teacher</span> : null}
                    {u.student_id ? <span>student</span> : null}
                    {!u.teacher_id && !u.student_id ? <span className="text-gray-400">—</span> : null}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="btn-outline" onClick={() => deleteUser(u.id)} disabled={!isAdmin}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteUserModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} defaultRole="teacher" onSuccess={() => { setInviteOpen(false); load(); setToast({ type: 'success', msg: 'Приглашение отправлено' }) }} />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
    </div>
  )
}