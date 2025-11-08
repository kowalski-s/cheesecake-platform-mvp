import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

export default function AssignmentsList({ mode = 'teacher', onSelectAssignment }) {
  const { role } = useAuth()
  const normalizedRole = useMemo(() => (role || '').trim().toLowerCase(), [role])
  const isTeacher = normalizedRole === 'teacher' || normalizedRole === 'admin'
  const isStudent = normalizedRole === 'student'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // For teacher, also load students to compute not-submitted count
  const [students, setStudents] = useState([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      let assignmentsQuery = supabase.from('assignments').select('id, title, description, due_date, teacher_id, material_id, created_at')
      if (mode === 'teacher' && isTeacher) {
        assignmentsQuery = assignmentsQuery.eq('teacher_id', uid)
      }
      // student: RLS will limit by own teacher
      const { data: asns, error: aErr } = await assignmentsQuery.order('created_at', { ascending: false })
      if (aErr) throw aErr
      setItems(asns || [])

      if (mode === 'teacher' && isTeacher) {
        const { data: studs } = await supabase.from('students').select('id, display_name').eq('teacher_id', uid)
        setStudents(studs || [])
      }
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить задания')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [mode])

  const computeStats = async (assignmentId) => {
    const { data: subs } = await supabase.from('submissions').select('id, student_id, grade').eq('assignment_id', assignmentId)
    const submitted = subs?.length || 0
    const reviewed = (subs || []).filter(s => !!(s.grade || '').trim()).length
    const awaiting = submitted - reviewed
    const notSubmitted = Math.max(0, students.length - submitted)
    return { submitted, reviewed, awaiting, notSubmitted }
  }

  const [statsMap, setStatsMap] = useState({})
  useEffect(() => {
    const loadStats = async () => {
      if (mode !== 'teacher' || !isTeacher) return
      const entries = {}
      for (const a of items) {
        entries[a.id] = await computeStats(a.id)
      }
      setStatsMap(entries)
    }
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mode, isTeacher])

  if (loading) return <section className="card"><div className="py-4 text-center text-sm text-gray-500">Загрузка…</div></section>
  if (error) return <section className="card"><div className="py-4 text-center text-sm text-red-600">{error}</div></section>

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="mb-3 text-lg font-semibold">Задания</h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map(a => (
          <li key={a.id} className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-sm text-gray-500">Дедлайн: {a.due_date ? new Date(a.due_date).toLocaleString() : '—'}</div>
              </div>
              <div className="flex items-center gap-3">
                {mode === 'teacher' && statsMap[a.id] && (
                  <div className="text-xs text-gray-500">
                    не сдано: {statsMap[a.id].notSubmitted} • ожид.: {statsMap[a.id].awaiting} • проверено: {statsMap[a.id].reviewed}
                  </div>
                )}
                <button className="btn-outline" onClick={() => onSelectAssignment?.(a)}>Открыть</button>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-8 text-center text-gray-500">Нет заданий</li>
        )}
      </ul>
    </section>
  )
}