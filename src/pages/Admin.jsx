import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminPage() {
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [filterEnding, setFilterEnding] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: studs }, { data: ts }] = await Promise.all([
        supabase.from('students').select('id, display_name, remaining_lessons').order('display_name'),
        supabase.from('teachers').select('id, display_name').order('display_name'),
      ])
      setStudents(studs || [])
      setTeachers(ts || [])
    }
    load()
  }, [])

  const filteredStudents = filterEnding ? students.filter(s => (s.remaining_lessons ?? 0) <= 1) : students

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Преподаватели</h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {teachers.map(t => (
            <li key={t.id} className="rounded-xl border border-gray-100 p-3">
              <div className="font-medium">{t.display_name}</div>
            </li>
          ))}
          {teachers.length === 0 && <li className="text-sm text-gray-500">Нет преподавателей</li>}
        </ul>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ученики</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filterEnding} onChange={(e) => setFilterEnding(e.target.checked)} />
            Показать с заканчивающимся абонементом
          </label>
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {filteredStudents.map(s => (
            <li key={s.id} className="rounded-xl border border-gray-100 p-3">
              <div className="font-medium">{s.display_name}</div>
              <div className="text-sm text-gray-500">Осталось занятий: {s.remaining_lessons ?? 0}</div>
            </li>
          ))}
          {filteredStudents.length === 0 && <li className="text-sm text-gray-500">Нет учеников</li>}
        </ul>
      </section>
    </div>
  )
}