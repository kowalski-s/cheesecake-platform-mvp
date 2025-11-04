import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { format } from 'date-fns'
import Loading from '../components/ui/Loading'

export default function SchedulePage() {
  // TODO: фильтры (teacher, class, status), загрузка lessons с пагинацией, пустые состояния
  const [filters, setFilters] = useState({ teacher: '', className: '', status: '' })
  const [lessons, setLessons] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        setError('Supabase не настроен')
        return
      }
      
      try {
        const { data: ts } = await supabase.from('teachers').select('id, display_name').order('display_name')
        setTeachers(ts || [])
        await load()
      } catch (err) {
        console.error('Ошибка загрузки данных:', err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      let query = supabase.from('lessons').select('id, title, start_at, status, teacher:teachers(display_name), class_name, student:students(display_name)').order('start_at', { ascending: true })
      if (filters.teacher) query = query.eq('teacher_id', filters.teacher)
      if (filters.className) query = query.ilike('class_name', `%${filters.className}%`)
      if (filters.status) query = query.eq('status', filters.status)
      const { data } = await query
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

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Занятия</h2>
            <ul className="divide-y divide-gray-100">
              {lessons.map(l => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{l.title} <span className="text-gray-400">({l.class_name})</span></div>
                    <div className="text-sm text-gray-500">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')} • {l.teacher?.display_name} • {l.student?.display_name}</div>
                  </div>
                  <span className="rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{l.status}</span>
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
        </>
      )}
    </div>
  )
}