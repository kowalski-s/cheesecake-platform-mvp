import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/ui/Loading'
import toast from '@/lib/safeToast'
import { toSupabaseTimestamptz } from '@/lib/datetime'

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
  // Dashboard metrics
  const [metrics, setMetrics] = useState({ total: 0, withStudents: 0, without: 0, busiestName: '—', busiestHours: 0 })
  // Sorting & filtering
  const [sortKey, setSortKey] = useState('name') // name | students | hoursWeek
  const [sortDir, setSortDir] = useState('asc') // asc | desc
  const [loadFilter, setLoadFilter] = useState('all') // all | no | overloaded

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured || !supabase) {
        setError('Supabase не настроен')
        return
      }
      let query = supabase.from('teachers').select('id, display_name, bio, user_id').order('display_name')
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

      // Compute time ranges
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
      // Start of current week (Monday 00:00 local)
      const d0 = new Date(now)
      const day = (d0.getDay() + 6) % 7 // 0..6, Monday=0
      const startOfWeek = new Date(d0)
      startOfWeek.setHours(0,0,0,0)
      startOfWeek.setDate(startOfWeek.getDate() - day)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 7)
      endOfWeek.setMilliseconds(endOfWeek.getMilliseconds() - 1)
      const next7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

      // Fetch lessons for recent 30 days (planned/done) to compute students_count and withStudents
      const { data: recentLessons, error: recentErr } = await supabase
        .from('lessons')
        .select('id, teacher_id, student_id, start_at, status, duration_min')
        .gte('start_at', toSupabaseTimestamptz(thirtyDaysAgo))
        .in('status', ['planned','done'])
      if (recentErr) throw recentErr

      // Fetch lessons for current week (status != cancelled) for week counts and hours
      const { data: weekLessons, error: weekErr } = await supabase
        .from('lessons')
        .select('id, teacher_id, student_id, start_at, status, duration_min')
        .gte('start_at', toSupabaseTimestamptz(startOfWeek))
        .lte('start_at', toSupabaseTimestamptz(endOfWeek))
        .neq('status', 'cancelled')
      if (weekErr) throw weekErr

      // Fetch lessons for next 7 days (planned/done) to compute busiest teacher
      const { data: nextLessons, error: nextErr } = await supabase
        .from('lessons')
        .select('id, teacher_id, start_at, status, duration_min')
        .gte('start_at', toSupabaseTimestamptz(now))
        .lte('start_at', toSupabaseTimestamptz(next7Days))
        .in('status', ['planned','done'])
      if (nextErr) throw nextErr

      // Aggregate per-teacher metrics
      const studentsByTeacher = new Map()
      ;(recentLessons || []).forEach(l => {
        if (!l.teacher_id || !l.student_id) return
        const set = studentsByTeacher.get(l.teacher_id) ?? new Set()
        set.add(l.student_id)
        studentsByTeacher.set(l.teacher_id, set)
      })

      const weekCountsByTeacher = new Map()
      const weekMinutesByTeacher = new Map()
      ;(weekLessons || []).forEach(l => {
        if (!l.teacher_id) return
        weekCountsByTeacher.set(l.teacher_id, (weekCountsByTeacher.get(l.teacher_id) || 0) + 1)
        const mins = Number(l.duration_min || 0)
        weekMinutesByTeacher.set(l.teacher_id, (weekMinutesByTeacher.get(l.teacher_id) || 0) + mins)
      })

      const nextMinutesByTeacher = new Map()
      ;(nextLessons || []).forEach(l => {
        if (!l.teacher_id) return
        const mins = Number(l.duration_min || 0)
        nextMinutesByTeacher.set(l.teacher_id, (nextMinutesByTeacher.get(l.teacher_id) || 0) + mins)
      })

      // Merge into items with derived fields
      const merged = base.map(t => {
        const studentsCount = (studentsByTeacher.get(t.id) || new Set()).size
        const weekCount = Number(weekCountsByTeacher.get(t.id) || 0)
        const hoursWeek = Math.round(((Number(weekMinutesByTeacher.get(t.id) || 0) / 60) + Number.EPSILON) * 10) / 10
        let loadLevel = 'low'
        if (hoursWeek > 10) loadLevel = 'high'
        else if (hoursWeek >= 4) loadLevel = 'medium'
        return {
          ...t,
          user_display_name: t.user_id ? userInfoById[t.user_id]?.display_name || null : null,
          user_email: t.user_id ? userInfoById[t.user_id]?.email || null : null,
          students_count: studentsCount,
          lessons_week_count: weekCount,
          hours_week: hoursWeek,
          load_level: loadLevel,
        }
      })
      setItems(merged)

      // Compute dashboard metrics
      const total = merged.length
      const withStudents = merged.filter(x => (x.students_count || 0) > 0).length
      const without = Math.max(0, total - withStudents)
      // busiest in next 7 days
      let busiestId = null
      let busiestMins = 0
      nextMinutesByTeacher.forEach((mins, tid) => {
        if (mins > busiestMins) { busiestMins = mins; busiestId = tid }
      })
      const busiestHours = Math.round(((busiestMins / 60) + Number.EPSILON) * 10) / 10
      const busiestName = busiestId ? (base.find(t => t.id === busiestId)?.display_name || '—') : '—'
      setMetrics({ total, withStudents, without, busiestName, busiestHours })
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
      {/* Mini-dashboard metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.total}</div>
          <div className="text-sm text-gray-600">Всего преподавателей</div>
        </div>
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.withStudents}</div>
          <div className="text-sm text-gray-600">С учениками (30 дней)</div>
        </div>
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.without}</div>
          <div className="text-sm text-gray-600">Без учеников</div>
        </div>
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.busiestHours}</div>
          <div className="text-sm text-gray-600">Самый загруженный: {metrics.busiestName}</div>
        </div>
      </div>
      <div className="card">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Поиск</label>
            <input className="input" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value) }} placeholder="имя или email" />
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
        {/* Sorting and filter controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Сортировка</label>
            <div className="flex gap-2">
              <select className="input" value={sortKey} onChange={(e) => { setPage(0); setSortKey(e.target.value) }}>
                <option value="name">Имя</option>
                <option value="students">Ученики</option>
                <option value="hoursWeek">Часы на неделе</option>
              </select>
              <select className="input" value={sortDir} onChange={(e) => { setPage(0); setSortDir(e.target.value) }}>
                <option value="asc">По возрастанию</option>
                <option value="desc">По убыванию</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Нагрузка</label>
            <select className="input" value={loadFilter} onChange={(e) => { setPage(0); setLoadFilter(e.target.value) }}>
              <option value="all">Все</option>
              <option value="no">Без учеников</option>
              <option value="overloaded">Перегруженные (> 10ч)</option>
            </select>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ученики (30 дней)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Занятий на неделе</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Часов на неделе</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Нагрузка</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                // Client-side search, filter, sort, paginate
                let arr = [...items]
                const term = (search || '').trim().toLowerCase()
                if (term) {
                  arr = arr.filter(t => (
                    (t.display_name || '').toLowerCase().includes(term) ||
                    (t.user_email || '').toLowerCase().includes(term)
                  ))
                }
                if (loadFilter === 'no') arr = arr.filter(t => (t.students_count || 0) === 0)
                if (loadFilter === 'overloaded') arr = arr.filter(t => t.hours_week > 10)

                arr.sort((a, b) => {
                  let va = 0, vb = 0
                  if (sortKey === 'name') {
                    va = (a.display_name || '').localeCompare(b.display_name || '')
                    return sortDir === 'asc' ? va : -va
                  } else if (sortKey === 'students') {
                    va = Number(a.students_count || 0); vb = Number(b.students_count || 0)
                  } else if (sortKey === 'hoursWeek') {
                    va = Number(a.hours_week || 0); vb = Number(b.hours_week || 0)
                  }
                  return sortDir === 'asc' ? (va - vb) : (vb - va)
                })

                const from = page * pageSize
                const to = from + pageSize
                return arr.slice(from, to)
              })().map(t => (
                <tr key={t.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      <Link className="text-orange-600" to={`/admin/teachers/${t.id}`}>{t.display_name}</Link>
                    </div>
                    {t.user_email && (<div className="text-xs text-gray-500">{t.user_email}</div>)}
                    <div className="text-xs text-gray-400">{t.bio}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-gray-100 text-gray-800 px-2 text-xs font-semibold">{t.students_count ?? 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-gray-100 text-gray-800 px-2 text-xs font-semibold">{t.lessons_week_count ?? 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-gray-100 text-gray-800 px-2 text-xs font-semibold">{t.hours_week?.toFixed ? t.hours_week.toFixed(1) : (Number(t.hours_week || 0).toFixed(1))}</span>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const lvl = t.load_level || 'low'
                      const label = lvl === 'high' ? 'высокая' : (lvl === 'medium' ? 'средняя' : 'низкая')
                      const cls = lvl === 'high' ? 'bg-red-100 text-red-800' : (lvl === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')
                      return <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${cls}`}>{label}</span>
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Link className="btn-outline" to={`/admin/teachers/${t.id}`}>Профиль</Link>
                      <button className="btn-outline" onClick={() => startEdit(t)}>Редактировать</button>
                      {!t.user_id && (
                        <select className="input text-xs" onChange={(e) => bindInline(t.id, e.target.value)} defaultValue="">
                          <option value="">Привязать пользователя...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)}
                        </select>
                      )}
                    </div>
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