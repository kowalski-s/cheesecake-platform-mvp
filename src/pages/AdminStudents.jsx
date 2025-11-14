import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/ui/Loading'
import toast from '@/lib/safeToast'
import { createSubscriptionForStudent, updateSubscription, fetchActiveSubscriptionsByUsers, decrementSubscription, archiveSubscription } from '@/api/subscriptions'

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
  // Dashboard metrics
  const [metrics, setMetrics] = useState({ total: 0, withActive: 0, without: 0, endingSoon: 0 })
  // Sorting & filtering
  const [sortKey, setSortKey] = useState('name') // name | activeCount | lessonsLeft
  const [sortDir, setSortDir] = useState('asc') // asc | desc
  const [statusFilter, setStatusFilter] = useState('all') // all | with | without | ending
  // Local modal: Add subscription
  const [addSubFor, setAddSubFor] = useState(null) // student row
  const [addSubForm, setAddSubForm] = useState({ lessonsCount: 8, endDate: '' })
  const [editingSubscription, setEditingSubscription] = useState(null) // subscriptions row when editing
  

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

      // Fetch active subscriptions strictly by students.user_id
      const ids = base.map(s => s.user_id).filter(Boolean)
      const activeSubsByUser = ids.length ? await fetchActiveSubscriptionsByUsers(ids) : new Map()

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
        const subsArr = activeSubsByUser.get(s.user_id) || []
        const activeSubsCount = subsArr.length
        const subsLessons = subsArr.reduce((acc, cur) => acc + (Number(cur?.remaining_lessons) || 0), 0)
        const uinfo = s.user_id ? userInfoById[s.user_id] : null
        // Source of truth: subscriptions only; if no active subs, lessonsLeft = 0
        const remainingEffective = activeSubsCount > 0 ? subsLessons : 0
        // soonEnding only if there is at least one active subscription
        const soonEnding = activeSubsCount > 0 && typeof remainingEffective === 'number' && remainingEffective <= 2
        // Use real end_at: choose the farthest end date among active subs
        const maxEndAt = subsArr.reduce((acc, cur) => {
          const ea = cur?.end_at ? new Date(cur.end_at) : null
          return (!ea) ? acc : (!acc || ea > acc ? ea : acc)
        }, null)
        const daysLeft = maxEndAt ? Math.ceil((maxEndAt.getTime() - Date.now()) / (24*3600*1000)) : null
        const statusText = activeSubsCount === 0 ? 'нет абонемента' : (soonEnding ? 'скоро закончится' : 'активен')
        return {
          ...s,
          active_subscriptions_count: activeSubsCount,
          remaining_effective: remainingEffective,
          subscription_end_days: daysLeft,
          user_display_name: uinfo?.display_name || null,
          user_email: uinfo?.email || null,
          status_text: statusText,
          soon_ending: soonEnding,
        }
      })
      setItems(merged)

      // Compute top-level metrics from merged
      const total = merged.length
      const withActive = merged.filter(x => (x.active_subscriptions_count || 0) > 0).length
      const endingSoon = merged.filter(x => (x.active_subscriptions_count || 0) > 0 && (x.remaining_effective || 0) <= 2).length
      const without = Math.max(0, total - withActive)
      setMetrics({ total, withActive, without, endingSoon })
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

  // Helpers
  const recomputeMetricsFromItems = (list) => {
    const total = list.length
    const withActive = list.filter(x => (x.active_subscriptions_count || 0) > 0).length
    const endingSoon = list.filter(x => (x.active_subscriptions_count || 0) > 0 && (x.remaining_effective || 0) <= 2).length
    const without = Math.max(0, total - withActive)
    setMetrics({ total, withActive, without, endingSoon })
  }

  const openAddSubscription = (studentRow) => {
    setAddSubFor(studentRow)
    setAddSubForm({ lessonsCount: 8, endDate: '' })
    setEditingSubscription(null)
  }
  const closeAddSubscription = () => {
    setAddSubFor(null)
    setEditingSubscription(null)
  }
  const openEditSubscription = async (studentRow) => {
    try {
      if (!studentRow?.user_id) {
        toast.error('У ученика не привязан пользователь')
        return
      }
      const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('id, user_id, remaining_lessons, end_at, active, created_at, lessons_total')
        .eq('user_id', studentRow.user_id)
        .eq('active', true)
      if (error) throw error
      if (!subs || subs.length === 0) {
        toast.error('Нет активного абонемента для редактирования')
        return
      }
      // Choose the one with the farthest end_at, fallback to latest created_at
      const chosen = subs.sort((a,b) => {
        const ea = a.end_at ? new Date(a.end_at).getTime() : -Infinity
        const eb = b.end_at ? new Date(b.end_at).getTime() : -Infinity
        if (ea !== eb) return eb - ea
        const ca = a.created_at ? new Date(a.created_at).getTime() : 0
        const cb = b.created_at ? new Date(b.created_at).getTime() : 0
        return cb - ca
      })[0]
      setAddSubFor(studentRow)
      setEditingSubscription(chosen)
      const prefillDate = chosen?.end_at ? new Date(chosen.end_at).toISOString().slice(0,10) : ''
      setAddSubForm({ lessonsCount: Number(chosen?.remaining_lessons || 1), endDate: prefillDate })
    } catch (e) {
      console.error('openEditSubscription failed', e)
      toast.error('Не удалось открыть модалку редактирования')
    }
  }
  const handleDecrementLesson = async (row) => {
    try {
      const uid = row?.user_id
      if (!uid) {
        toast.error('У ученика не привязан пользователь')
        return
      }
      const map = await fetchActiveSubscriptionsByUsers([uid])
      const subs = map.get(uid) || []
      if (subs.length === 0) {
        toast.error('У ученика нет активного абонемента')
        return
      }
      const main = subs
        .slice()
        .sort((a, b) => {
          const aEnd = a.end_at ? new Date(a.end_at).getTime() : 0
          const bEnd = b.end_at ? new Date(b.end_at).getTime() : 0
          if (bEnd !== aEnd) return bEnd - aEnd
          const aCr = a.created_at ? new Date(a.created_at).getTime() : 0
          const bCr = b.created_at ? new Date(b.created_at).getTime() : 0
          return bCr - aCr
        })[0]

      const left = Number(main?.remaining_lessons || 0)
      if (left <= 0) {
        toast.error('Нечего списывать — занятий не осталось')
        return
      }

      const updated = await decrementSubscription(main.id)

      setItems(prev => {
        const next = prev.map(s => {
          if (!s.user_id || s.user_id !== updated.user_id) return s
          const newRem = Math.max(0, Number(s.remaining_effective || 0) - 1)
          const hasActive = Number(s.active_subscriptions_count || 0) > 0
          const soon = hasActive && newRem <= 2
          const statusText = !hasActive
            ? 'нет абонемента'
            : newRem === 0
              ? 'нет занятий'
              : soon
                ? 'скоро заканчивается'
                : 'активен'
          return {
            ...s,
            remaining_effective: newRem,
            soon_ending: soon,
            status_text: statusText,
          }
        })
        recomputeMetricsFromItems(next)
        return next
      })

      toast.success('Занятие списано')
    } catch (e) {
      console.error('decrement lesson failed', e)
      toast.error('Не удалось списать занятие')
    }
  }
  const saveSubscription = async () => {
    try {
      if (!addSubFor) return
      const count = Math.max(1, Number(addSubForm.lessonsCount) || 8)
      if (!editingSubscription) {
        const created = await createSubscriptionForStudent(addSubFor.id, { lessonsCount: count, endDate: addSubForm.endDate || null })
        // Update local state for this student
        const newEndDays = created?.end_at ? Math.ceil((new Date(created.end_at).getTime() - Date.now()) / (24*3600*1000)) : null
        setItems(prev => {
          const next = prev.map(row => {
            if (!row.user_id || row.user_id !== created?.user_id) return row
            const newCount = (row.active_subscriptions_count || 0) + 1
            const newRem = Number(row.remaining_effective || 0) + (Number(created?.remaining_lessons) || count)
            const soon = newCount > 0 && newRem <= 2
            const statusText = soon ? 'скоро закончится' : 'активен'
            const daysLeft = typeof row.subscription_end_days === 'number' && typeof newEndDays === 'number'
              ? Math.max(row.subscription_end_days, newEndDays)
              : (newEndDays ?? row.subscription_end_days ?? null)
            return {
              ...row,
              active_subscriptions_count: newCount,
              remaining_effective: newRem,
              soon_ending: soon,
              status_text: statusText,
              subscription_end_days: daysLeft,
            }
          })
          recomputeMetricsFromItems(next)
          return next
        })
        toast.success('Абонемент создан')
        closeAddSubscription()
      } else {
        const updated = await updateSubscription(editingSubscription.id, { lessonsCount: count, endDate: addSubForm.endDate || null })
        const updatedDays = updated?.end_at ? Math.ceil((new Date(updated.end_at).getTime() - Date.now()) / (24*3600*1000)) : null
        setItems(prev => {
          const next = prev.map(row => {
            if (!row.user_id || row.user_id !== updated?.user_id) return row
            // adjust remaining_effective by delta on the edited subscription
            const prevSubRem = Number(editingSubscription?.remaining_lessons || 0)
            const newRemTotal = Math.max(0, Number(row.remaining_effective || 0) - prevSubRem + Number(updated?.remaining_lessons || count))
            const soon = (row.active_subscriptions_count || 0) > 0 && newRemTotal <= 2
            const statusText = soon ? 'скоро закончится' : 'активен'
            const daysLeft = typeof row.subscription_end_days === 'number' && typeof updatedDays === 'number'
              ? Math.max(row.subscription_end_days, updatedDays)
              : (updatedDays ?? row.subscription_end_days ?? null)
            return {
              ...row,
              remaining_effective: newRemTotal,
              soon_ending: soon,
              status_text: statusText,
              subscription_end_days: daysLeft,
            }
          })
          recomputeMetricsFromItems(next)
          return next
        })
        toast.success('Абонемент обновлён')
        closeAddSubscription()
      }
    } catch (e) {
      console.error('create subscription failed', e)
      toast.error(editingSubscription ? 'Не удалось обновить абонемент' : 'Не удалось создать абонемент')
    }
  }

  const handleArchiveSubscription = async () => {
    try {
      if (!editingSubscription) return
      if (!window.confirm('Точно удалить абонемент?')) return
      const prevRemaining = Math.max(0, Number(editingSubscription.remaining_lessons || 0))
      const archived = await archiveSubscription(editingSubscription.id)
      const userId = archived?.user_id || editingSubscription?.user_id || addSubFor?.user_id

      setItems(prev => {
        const next = prev.map(row => {
          if (!row.user_id || row.user_id !== userId) return row
          const newCount = Math.max(0, Number(row.active_subscriptions_count || 0) - 1)
          const newRem = Math.max(0, Number(row.remaining_effective || 0) - prevRemaining)
          const hasActive = newCount > 0
          const soon = hasActive && newRem <= 2
          const statusText = !hasActive
            ? 'нет абонемента'
            : newRem === 0
              ? 'нет занятий'
              : soon
                ? 'скоро заканчивается'
                : 'активен'
          return {
            ...row,
            active_subscriptions_count: newCount,
            remaining_effective: newRem,
            subscription_end_days: hasActive ? row.subscription_end_days : 0,
            soon_ending: soon,
            status_text: statusText,
          }
        })
        recomputeMetricsFromItems(next)
        return next
      })

      // If still has active subscriptions, recompute end days for this user only
      if (userId) {
        const map = await fetchActiveSubscriptionsByUsers([userId])
        const subs = map.get(userId) || []
        const maxEnd = subs.reduce((max, r) => {
          const t = r.end_at ? new Date(r.end_at).getTime() : 0
          return t > max ? t : max
        }, 0)
        const days = maxEnd ? Math.ceil((maxEnd - Date.now()) / (1000 * 60 * 60 * 24)) : 0
        setItems(prev => prev.map(row => row.user_id === userId ? { ...row, subscription_end_days: subs.length ? days : 0 } : row))
      }

      closeAddSubscription()
      toast.success('Абонемент удалён')
    } catch (e) {
      console.error('archive subscription failed', e)
      toast.error('Не удалось удалить абонемент')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ученики</h1>
        <button className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white" onClick={startCreate}>Добавить</button>
      </div>
      {/* Mini-dashboard metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.total}</div>
          <div className="text-sm text-gray-600">Всего учеников</div>
        </div>
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.withActive}</div>
          <div className="text-sm text-gray-600">С активным абонементом</div>
        </div>
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.without}</div>
          <div className="text-sm text-gray-600">Без абонемента</div>
        </div>
        <div className="bg-white rounded-2xl shadow card p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold">{metrics.endingSoon}</div>
          <div className="text-sm text-gray-600">Скоро заканчивается</div>
        </div>
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
        {/* Sorting and filter controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Сортировка</label>
            <div className="flex gap-2">
              <select className="input" value={sortKey} onChange={(e) => { setPage(0); setSortKey(e.target.value) }}>
                <option value="name">Имя ученика</option>
                <option value="activeCount">Активные абонементы</option>
                <option value="lessonsLeft">Оставшиеся занятия</option>
              </select>
              <select className="input" value={sortDir} onChange={(e) => { setPage(0); setSortDir(e.target.value) }}>
                <option value="asc">По возрастанию</option>
                <option value="desc">По убыванию</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Статус абонемента</label>
            <select className="input" value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value) }}>
              <option value="all">Все</option>
              <option value="with">С абонементом</option>
              <option value="without">Без абонемента</option>
              <option value="ending">Скоро заканчивается</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Преподаватель</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16 md:w-20">Активные абонементы</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20 md:w-24">Осталось</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28 md:w-32">До абонемента</th>
                <th className="px-3 py-3 text-right w-48 md:w-56" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(
                // Apply filter + sort + pagination on client side
                (() => {
                  let arr = [...items]
                  if (statusFilter === 'with') arr = arr.filter(x => (x.active_subscriptions_count || 0) > 0)
                  if (statusFilter === 'without') arr = arr.filter(x => (x.active_subscriptions_count || 0) === 0)
                  if (statusFilter === 'ending') arr = arr.filter(x => !!x.soon_ending)

                  arr.sort((a, b) => {
                    let va = 0, vb = 0
                    if (sortKey === 'name') { va = (a.display_name || '').localeCompare(b.display_name || '') }
                    else if (sortKey === 'activeCount') { va = Number(a.active_subscriptions_count || 0); vb = Number(b.active_subscriptions_count || 0) }
                    else if (sortKey === 'lessonsLeft') { va = Number(a.remaining_effective || 0); vb = Number(b.remaining_effective || 0) }
                    if (sortKey === 'name') {
                      return sortDir === 'asc' ? va : -va
                    } else {
                      return sortDir === 'asc' ? (va - vb) : (vb - va)
                    }
                  })

                  const from = page * pageSize
                  const to = from + pageSize
                  return arr.slice(from, to)
                })()
              ).map(s => (
                <tr key={s.id}>
                  <td className="px-6 py-4 align-top">
                    <div className="font-medium text-gray-900">
                      <Link className="text-orange-600" to={`/admin/students/${s.id}`}>{s.display_name}</Link>
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.user_email || s.user_id || '—'}
                    </div>
                    <div className="text-xs text-gray-400">{s.status_text}</div>
                    {!s.user_id && (
                      <div className="mt-2">
                        <select className="input w-56 text-xs" onChange={(e) => bindInline(s.id, e.target.value)} defaultValue="">
                          <option value="">Привязать пользователя...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {s.teacher?.id ? (
                      <Link className="text-orange-600" to={`/admin/teachers/${s.teacher.id}`}>{s.teacher?.display_name}</Link>
                    ) : (
                      s.teacher?.display_name || 'Не назначен'
                    )}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="inline-flex rounded-full bg-gray-100 text-gray-800 px-2 text-xs font-semibold">{s.active_subscriptions_count ?? 0}</span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    {(() => {
                      const rem = Number(s.remaining_effective || 0)
                      const cls = rem === 0 ? 'bg-red-100 text-red-800' : (rem <= 2 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800')
                      const canDec = rem > 0 && Number(s.active_subscriptions_count || 0) > 0
                      return (
                        <div className="inline-flex items-center gap-2 justify-center">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${cls}`}>{rem}</span>
                          {canDec && (
                            <button
                              className="btn-outline text-xs px-2 py-1 rounded-full"
                              title="Списать занятие"
                              onClick={() => handleDecrementLesson(s)}
                            >
                              −
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-4">
                    {(() => {
                      const days = s.subscription_end_days
                      const critical = typeof days === 'number' ? days < 14 : false
                      const cls = critical ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      const label = typeof days === 'number' ? `${Math.max(0, days)} дн.` : '—'
                      return <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${cls}`}>{label}</span>
                    })()}
                  </td>
                  <td className="px-3 py-4 text-right w-48 md:w-56">
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button className="btn-outline text-xs px-2 py-1" onClick={() => startEdit(s)}>Редактировать</button>
                      { (s.active_subscriptions_count ?? 0) === 0 ? (
                        <button className="btn-primary text-xs px-2 py-1" onClick={() => openAddSubscription(s)}>Добавить абонемент</button>
                      ) : (
                        <button className="btn-outline text-xs px-2 py-1" onClick={() => openEditSubscription(s)}>Изменить абонемент</button>
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

      {addSubFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
            <button onClick={closeAddSubscription} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">{editingSubscription ? `Изменить абонемент ученика ${addSubFor.display_name}` : `Добавить абонемент ученику ${addSubFor.display_name}`}</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Количество занятий</label>
                <input type="number" min={1} className="input" value={addSubForm.lessonsCount} onChange={(e) => setAddSubForm({ ...addSubForm, lessonsCount: Number(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дата окончания</label>
                <input type="date" className="input" value={addSubForm.endDate} onChange={(e) => setAddSubForm({ ...addSubForm, endDate: e.target.value })} />
                <div className="mt-1 text-xs text-gray-500">Если не выбрано, по умолчанию срок — 30 дней от сегодня (end_at сохраняется).</div>
              </div>
              <div className="flex justify-between gap-2">
                <div>
                  {!!editingSubscription && (
                    <button
                      className="btn-outline border-red-300 text-red-600 hover:bg-red-50"
                      onClick={handleArchiveSubscription}
                    >
                      Удалить абонемент
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn-outline" onClick={closeAddSubscription}>Отмена</button>
                  <button className="btn-primary" onClick={saveSubscription} disabled={!isAdmin}>Сохранить</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}