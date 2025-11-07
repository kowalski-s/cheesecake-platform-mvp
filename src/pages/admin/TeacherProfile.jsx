import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Loading from '../../components/ui/Loading'

export default function TeacherProfile() {
  const { id } = useParams()
  const [teacher, setTeacher] = useState(null)
  const [email, setEmail] = useState(null)
  const [students, setStudents] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [tRes, sRes, lRes, uRes] = await Promise.all([
        supabase.from('teachers').select('id, display_name, bio, specialization, user_id').eq('id', id).maybeSingle(),
        supabase.from('students').select('id, display_name, remaining_lessons').eq('teacher_id', id).order('display_name', { ascending: true }),
        supabase.from('lessons').select('id, title, start_at, status, student:students(id, display_name)').eq('teacher_id', id).gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(10),
        supabase.rpc('admin_get_user', { p_id: id }),
      ])
      setTeacher(tRes.data || null)
      setStudents(sRes.data || [])
      setUpcoming(lRes.data || [])
      const row = Array.isArray(uRes.data) && uRes.data.length > 0 ? uRes.data[0] : null
      setEmail(row?.email || null)
    } catch (e) {
      console.error('load teacher profile failed', e)
      setError('Не удалось загрузить профиль')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div className="py-10"><Loading /></div>
  if (error) return <div className="card p-6 text-center text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Преподаватель: {teacher?.display_name || teacher?.id}</h1>
          <p className="text-gray-600 text-sm">ID: {teacher?.id}</p>
        </div>
      </header>

      <section className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-medium">{email || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Специализация</div>
            <div className="font-medium">{teacher?.specialization || '—'}</div>
          </div>
          <div className="md:col-span-3">
            <div className="text-sm text-gray-500">Bio</div>
            <div className="font-medium whitespace-pre-wrap">{teacher?.bio || '—'}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Текущие ученики</h2>
        <ul className="divide-y divide-gray-100">
          {students.map(s => (
            <li key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <Link className="font-medium text-orange-600" to={`/admin/students/${s.id}`}>{s.display_name || s.id}</Link>
              </div>
              <div className="text-sm text-gray-600">осталось: {s.remaining_lessons ?? 0}</div>
            </li>
          ))}
          {students.length === 0 && <li className="py-3 text-sm text-gray-500">Нет данных</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Ближайшие занятия</h2>
        <ul className="divide-y divide-gray-100">
          {upcoming.map(l => (
            <li key={l.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{l.title}</div>
                <div className="text-sm text-gray-500">{new Date(l.start_at).toLocaleString()} • ученик: <Link className="text-orange-600" to={`/admin/students/${l.student?.id}`}>{l.student?.display_name || l.student?.id}</Link></div>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{l.status}</div>
            </li>
          ))}
          {upcoming.length === 0 && <li className="py-3 text-sm text-gray-500">Нет данных</li>}
        </ul>
      </section>
    </div>
  )
}