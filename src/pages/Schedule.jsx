import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { format } from 'date-fns'
import Loading from '../components/ui/Loading'
import { useAuth } from '../context/AuthContext'

export default function SchedulePage() {
  const { role, user } = useAuth()
  const normalizedRole = useMemo(() => role?.trim()?.toLowerCase() ?? null, [role])
  const canEdit = normalizedRole === 'admin' || normalizedRole === 'teacher'
  const isStudent = normalizedRole === 'student'
  // фильтры (teacher, class, status), загрузка lessons с пагинацией, пустые состояния
  const [filters, setFilters] = useState({ teacher: '', className: '', status: '' })
  const [lessons, setLessons] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        setError('Supabase не настроен')
        return
      }
      try {
        const { data: ts } = await withTimeout(supabase.from('teachers').select('id, display_name').order('display_name'), 8000)
        setTeachers(ts || [])
        await withTimeout(load(), 8000)
      } catch (err) {
        console.error('Ошибка загрузки данных:', err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const load = async (override) => {
    setLoading(true)
    try {
      const f = override ?? filters
      let query = supabase
        .from('lessons')
        .select('id, title, start_at, status, teacher:teachers(display_name), class_name, student:students(display_name)')
        .order('start_at', { ascending: true })
      if (f.teacher) query = query.eq('teacher_id', f.teacher)
      if (f.className) query = query.ilike('class_name', `%${f.className}%`)
      if (f.status) query = query.eq('status', f.status)
      const { data } = await withTimeout(query, 8000)
      setLessons(data || [])
    } catch (err) {
      console.error('Ошибка загрузки занятий:', err)
      setError('Не удалось загрузить занятия')
    } finally {
      setLoading(false)
    }
  }

  const update = (field, value) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    load(next)
  }


  const setStatus = async (lessonId, status) => {
    try {
      if (!canEdit) return
      const { error } = await supabase.from('lessons').update({ status }).eq('id', lessonId)
      if (error) throw error
      setLessons(lessons.map(l => l.id === lessonId ? { ...l, status } : l))
    } catch (e) {
      console.error('update status failed', e)
      setToast({ type: 'error', msg: 'Не удалось обновить статус' })
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Loading message="Загрузка расписания..." />
      ) : error ? (
        <div className="card p-8 text-center">
          <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Не удалось загрузить расписание</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => load()} className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand-muted">
            Попробовать снова
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Преподаватель</label>
                <select className="input" value={filters.teacher} onChange={(e) => update('teacher', e.target.value)}>
                  <option value="">Все</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Класс</label>
                <input className="input" value={filters.className} onChange={(e) => update('className', e.target.value)} placeholder="например HSK1" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Статус</label>
                <select className="input" value={filters.status} onChange={(e) => update('status', e.target.value)}>
                  <option value="">Любой</option>
                  <option value="planned">Запланировано</option>
                  <option value="done">Проведено</option>
                  <option value="canceled">Отменено</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="btn-outline w-full" onClick={load}>Обновить</button>
              </div>
            </div>
          </div>

          {/* Форма создания занятия удалена согласно требованиям; оставляем только список и фильтры */}

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Занятия</h2>
            <ul className="divide-y divide-gray-100">
              {lessons.map(l => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{l.title} <span className="text-gray-400">({l.class_name})</span></div>
                    <div className="text-sm text-gray-500">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')} • {l.teacher?.display_name} • {l.student?.display_name}</div>
                  </div>
                  {canEdit ? (
                    <select className="input w-36" value={l.status} onChange={(e) => setStatus(l.id, e.target.value)}>
                      <option value="planned">Запланировано</option>
                      <option value="done">Проведено</option>
                      <option value="canceled">Отменено</option>
                    </select>
                  ) : (
                    <span className="rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{l.status}</span>
                  )}
                </li>
              ))}
              {lessons.length === 0 && (
                <li className="py-8">
                  <div className="text-center">
                    <div className="mb-2 text-sm text-gray-500">У вас пока нет занятий</div>
                    <a href="/teachers" className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand-muted">Посмотреть всех преподавателей</a>
                  </div>
                </li>
              )}
            </ul>
          </section>

          {toast && (
            <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast?.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast?.msg}</div>
          )}
        </>
      )}
    </div>
  )
}