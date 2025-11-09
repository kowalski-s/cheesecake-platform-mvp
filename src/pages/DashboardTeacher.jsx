import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

export default function DashboardTeacher() {
  // TODO: список учеников, расписание, отметка проведённого урока (patch в lessons.status), проверка ДЗ
  const [schedule, setSchedule] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return

      const [{ data: lessons }, { data: studs }] = await Promise.all([
        supabase.from('lessons').select('id, title, start_at, status, student:students(display_name)').eq('teacher_id', user.id).order('start_at', { ascending: true }),
        supabase.from('students').select('id, display_name').eq('teacher_id', user.id).order('display_name'),
      ])

      setSchedule(lessons || [])
      setStudents(studs || [])
      setLoading(false)
    }
    load()
  }, [])

  const markConducted = async (lessonId) => {
    await supabase.from('lessons').update({ status: 'done' }).eq('id', lessonId)
    setSchedule(prev => prev.map(l => l.id === lessonId ? { ...l, status: 'done' } : l))
  }

  if (loading) return <div className="py-10 text-center">Загрузка…</div>

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Моё расписание</h2>
        <ul className="divide-y divide-gray-100">
          {schedule.map(l => (
            <li key={l.id} className="flex items-center justify-between py-3">
              <Link to={`/lesson/${l.id}`} className="group">
                <div className="font-medium group-hover:text-orange-600">{l.title}</div>
                <div className="text-sm text-gray-500">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')} • {l.student?.display_name}</div>
              </Link>
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{l.status}</span>
                {l.status !== 'done' && (
                  <button className="btn-outline" onClick={() => markConducted(l.id)}>Отметить проведено</button>
                )}
              </div>
            </li>
          ))}
          {schedule.length === 0 && <li className="py-3 text-sm text-gray-500">Нет занятий</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Мои ученики</h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {students.map(s => (
            <li key={s.id} className="rounded-xl border border-gray-100 p-3">
              <div className="font-medium">{s.display_name}</div>
            </li>
          ))}
          {students.length === 0 && <li className="text-sm text-gray-500">Нет учеников</li>}
        </ul>
      </section>
    </div>
  )
}