import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { format } from 'date-fns'
import Loading from '../components/ui/Loading'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from '@/lib/safeToast'

export default function SchedulePage() {
  const { role, user } = useAuth()
  const normalizedRole = useMemo(() => role?.trim()?.toLowerCase() ?? null, [role])
  const canEdit = normalizedRole === 'admin' || normalizedRole === 'teacher'
  const isStudent = normalizedRole === 'student'
  // фильтры (teacher, class, status), загрузка lessons с пагинацией, пустые состояния
  const [filters, setFilters] = useState({ teacher: '', className: '', status: '' })
  const [lessons, setLessons] = useState([])
  const [page, setPage] = useState(0)
  const pageSize = 20
  const [total, setTotal] = useState(0)
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [teacherMap, setTeacherMap] = useState({})
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
        setError(err?.message || 'Не удалось загрузить данные')
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
        .select('id, title, start_at, status, teacher_id, teacher:teachers(display_name), class_name, student:students(display_name)', { count: 'exact' })
        .order('start_at', { ascending: true })
      if (f.teacher) query = query.eq('teacher_id', f.teacher)
      if (f.className) query = query.ilike('class_name', `%${f.className}%`)
      if (f.status) query = query.eq('status', f.status)
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, count, error } = await withTimeout(query.range(from, to), 8000)
      if (error) throw error
      setLessons(data || [])
      setTotal(count || 0)

      // Доп. шаг: загрузка имён преподавателей одной пачкой и формирование карты id -> display_name
      const ids = [...new Set((data || []).map(l => l?.teacher_id).filter(Boolean))]
      if (ids.length > 0) {
        const { data: tlist } = await withTimeout(
          supabase.from('teachers').select('id, display_name').in('id', ids),
          8000
        )
        const map = Object.fromEntries((tlist || []).map(t => [t.id, t.display_name]))
        setTeacherMap(map)
      } else {
        setTeacherMap({})
      }
    } catch (err) {
      console.error('Ошибка загрузки занятий:', err)
      const msg = err?.message || 'Не удалось загрузить расписание'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const update = (field, value) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    setPage(0)
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
      toast.error(`Не удалось обновить статус: ${e?.message || 'неизвестная ошибка'}`)
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
            {/* Toolbar: Фильтры слева, пагинация справа */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              {/* Левая часть: три фильтра + кнопка Обновить */}
              <div className="flex flex-wrap items-end gap-3 lg:flex-nowrap lg:gap-4">
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
                  <button
                    className="btn-outline"
                    onClick={() => { setPage(0); load(); }}
                    aria-label="Обновить список занятий"
                    title="Обновить список занятий"
                  >
                    Обновить
                  </button>
                </div>
              </div>

              {/* Правая часть: компактная пагинация */}
              <div className="mt-2 sm:mt-2 lg:mt-0 self-center sm:self-end min-h-[40px] flex items-center justify-center sm:justify-end gap-2">
                <button
                  className="btn-outline min-w-[84px]"
                  onClick={() => { setPage(Math.max(0, page - 1)); load(); }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && page > 0) {
                      e.preventDefault()
                      setPage(Math.max(0, page - 1))
                      load()
                    }
                  }}
                  disabled={page === 0}
                  aria-label="Предыдущая страница"
                  title="Предыдущая страница"
                >
                  Назад
                </button>
                <span className="text-sm text-gray-600">Стр. {page + 1} / {Math.max(1, Math.ceil((total || 0) / pageSize))}</span>
                <button
                  className="btn-outline min-w-[84px]"
                  onClick={() => {
                    const maxPages = Math.max(1, Math.ceil((total || 0) / pageSize))
                    const nextPage = Math.min(maxPages - 1, page + 1)
                    setPage(nextPage)
                    load()
                  }}
                  onKeyDown={(e) => {
                    const maxPages = Math.max(1, Math.ceil((total || 0) / pageSize))
                    const isDisabled = (page + 1) >= maxPages
                    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                      e.preventDefault()
                      const nextPage = Math.min(maxPages - 1, page + 1)
                      setPage(nextPage)
                      load()
                    }
                  }}
                  disabled={(page + 1) >= Math.max(1, Math.ceil((total || 0) / pageSize))}
                  aria-label="Следующая страница"
                  title="Следующая страница"
                >
                  Вперёд
                </button>
              </div>
            </div>
          </div>

          {/* Форма создания занятия удалена согласно требованиям; оставляем только список и фильтры */}

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Занятия</h2>
            <ul className="divide-y divide-gray-100">
              {lessons.map(l => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <Link to={`/lesson/${l.id}`} className="group">
                    <div className="font-medium group-hover:text-orange-600">{l.title} <span className="text-gray-400">({l.class_name})</span></div>
                    <div className="text-sm text-gray-500">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')} • {teacherMap[l.teacher_id] ?? '—'} • {l.student?.display_name}</div>
                  </Link>
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
                    <div className="mb-2 text-sm text-gray-500">Нет занятий по выбранным фильтрам</div>
                    <a href="/teachers" className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand-muted">Посмотреть всех преподавателей</a>
                  </div>
                </li>
              )}
            </ul>
          </section>

          
        </>
      )}
    </div>
  )
}