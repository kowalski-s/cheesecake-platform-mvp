import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import Loading from '@/components/ui/Loading'
import DayGrid from '@/components/schedule/DayGrid'
import EventDrawer from '@/components/schedule/EventDrawer'
import { fetchLessons, getMyTeacherId } from '@/lib/api'
import { formatDateOnlyYYYYMMDD, parseDateOnlyYYYYMMDD, toSupabaseTimestamptz, formatLocalDateTimeInput } from '@/lib/datetime'

export default function TeacherSchedulePage() {
  const { role } = useAuth()
  const isAdmin = (role || '').trim().toLowerCase() === 'admin'
  const isTeacher = (role || '').trim().toLowerCase() === 'teacher' || isAdmin
  const [date, setDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([])
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  // Load teachers list (admin: all; teacher: only self)
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setLoading(true)
        setError(null)
        if (isAdmin) {
          const { data } = await supabase.from('teachers').select('id, display_name').order('display_name')
          setTeachers(data || [])
          setSelectedTeacherIds((data || []).map(t => t.id))
        } else {
          const myTid = await getMyTeacherId(supabase)
          if (!myTid) { setTeachers([]); setSelectedTeacherIds([]) }
          else { const { data } = await supabase.from('teachers').select('id, display_name').eq('id', myTid); setTeachers(data || []); setSelectedTeacherIds([myTid]) }
        }
      } catch (e) {
        setError('Не удалось загрузить преподавателей')
      } finally {
        setLoading(false)
      }
    }
    if (isTeacher) loadTeachers()
  }, [isAdmin, isTeacher])

  // Load students (for selects)
  useEffect(() => {
    const loadStudents = async () => {
      const { data } = await supabase.from('students').select('id, display_name').order('display_name')
      setStudents(data || [])
    }
    loadStudents()
  }, [])

  const dayStartIso = useMemo(() => { const d = new Date(date); d.setHours(0,0,0,0); return toSupabaseTimestamptz(d) }, [date])
  const dayEndIso = useMemo(() => { const d = new Date(date); d.setHours(24,0,0,0); return toSupabaseTimestamptz(d) }, [date])

  const refetchLessons = async () => {
    try {
      const data = await fetchLessons(supabase, { start: dayStartIso, end: dayEndIso, teacherIds: selectedTeacherIds })
      setLessons(data)
    } catch (e) {
      setError('Не удалось загрузить расписание')
    }
  }

  useEffect(() => { if (selectedTeacherIds.length) refetchLessons() }, [dayStartIso, dayEndIso, selectedTeacherIds])

  const gotoToday = () => setDate(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const gotoPrev = () => setDate(prev => new Date(prev.getTime() - 24*60*60*1000))
  const gotoNext = () => setDate(prev => new Date(prev.getTime() + 24*60*60*1000))

  const handleEmptySlotClick = ({ teacher, start }) => {
    setEditing({ teacher_id: teacher.id, start_at: formatLocalDateTimeInput(start), duration_min: 60, status: 'planned', comment: '' })
    setDrawerOpen(true)
  }

  const handleLessonClick = (l) => { setEditing(l); setDrawerOpen(true) }

  const handleSaved = () => { refetchLessons() }
  const handleDeleted = () => { refetchLessons() }

  if (!isTeacher) return <div className="card p-6">Доступ запрещён</div>
  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <PageHeader title="Расписание (день)" />
      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {/* Left: filters */}
        <div className="card p-3 space-y-3">
          <label className="text-sm">Дата</label>
          <input type="date" className="w-full border rounded p-2" value={formatDateOnlyYYYYMMDD(date)} onChange={(e) => {
            const d = parseDateOnlyYYYYMMDD(e.target.value)
            if (d) setDate(d)
          }} />
          <div className="flex items-center gap-2">
            <button className="btn-outline" onClick={gotoToday}>Сегодня</button>
            <button className="btn-outline" onClick={gotoPrev}>Назад</button>
            <button className="btn-outline" onClick={gotoNext}>Вперёд</button>
          </div>
          {isAdmin && (
            <div className="mt-2 space-y-1">
              <div className="text-sm">Преподаватели</div>
              {teachers.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedTeacherIds.includes(t.id)} onChange={(e) => {
                    setSelectedTeacherIds(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))
                  }} />
                  <span>{t.display_name ?? t.id}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Center: day grid */}
        <div className="card p-3 overflow-auto">
          <DayGrid
            date={date}
            teachers={teachers.filter(t => selectedTeacherIds.includes(t.id))}
            lessons={lessons}
            onEmptySlotClick={handleEmptySlotClick}
            onLessonClick={handleLessonClick}
          />
        </div>

        {/* Right: event drawer */}
        <div className="relative">
          <EventDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            date={date}
            teachers={teachers}
            students={students}
            editing={editing?.id ? editing : null}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        </div>
      </div>
    </div>
  )
}