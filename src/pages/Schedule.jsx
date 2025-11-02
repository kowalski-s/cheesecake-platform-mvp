import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

export default function SchedulePage() {
  const [filters, setFilters] = useState({ teacher: '', className: '', status: '' })
  const [lessons, setLessons] = useState([])
  const [teachers, setTeachers] = useState([])

  useEffect(() => {
    const init = async () => {
      const { data: ts } = await supabase.from('teachers').select('id, display_name').order('display_name')
      setTeachers(ts || [])
      await load()
    }
    init()
  }, [])

  const load = async () => {
    let query = supabase.from('lessons').select('id, title, start_at, status, teacher:teachers(display_name), class_name, student:students(display_name)').order('start_at', { ascending: true })
    if (filters.teacher) query = query.eq('teacher_id', filters.teacher)
    if (filters.className) query = query.ilike('class_name', `%${filters.className}%`)
    if (filters.status) query = query.eq('status', filters.status)
    const { data } = await query
    setLessons(data || [])
  }

  const update = (field, value) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    load(next)
  }

  return (
    <div className="space-y-6">
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
          {lessons.length === 0 && <li className="py-3 text-sm text-gray-500">Нет занятий по выбранным фильтрам</li>}
        </ul>
      </section>
    </div>
  )
}