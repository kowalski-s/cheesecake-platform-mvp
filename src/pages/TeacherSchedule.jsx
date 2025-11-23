import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import Loading from '@/components/ui/Loading'
import DayGrid from '@/components/schedule/DayGrid'
import WeekGrid from '@/components/schedule/WeekGrid'
import EventDrawer from '@/components/schedule/EventDrawer'
import { fetchLessons, getMyTeacherId } from '@/lib/api'
import { formatDateOnlyYYYYMMDD, parseDateOnlyYYYYMMDD, toSupabaseTimestamptz, formatLocalDateTimeInput } from '@/lib/datetime'
import { startOfWeek, format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function TeacherSchedulePage() {
  const { role } = useAuth()
  const isAdmin = (role || '').trim().toLowerCase() === 'admin'
  const isTeacher = (role || '').trim().toLowerCase() === 'teacher' || isAdmin
  
  // View mode: 'day' or 'week'
  const [viewMode, setViewMode] = useState('week')
  
  // Date state: для дня - конкретная дата, для недели - начало недели
  const [date, setDate] = useState(() => { 
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return viewMode === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : d
  })
  
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([])
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [initialStartAt, setInitialStartAt] = useState(null)
  const [initialDurationMin, setInitialDurationMin] = useState(null)
  
  // Filters
  const [filters, setFilters] = useState({
    teacher: '',
    className: '',
    status: '',
  })

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
          if (!myTid) { 
            setTeachers([])
            setSelectedTeacherIds([])
          } else { 
            const { data } = await supabase.from('teachers').select('id, display_name').eq('id', myTid)
            setTeachers(data || [])
            setSelectedTeacherIds([myTid])
          }
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

  // Calculate date range based on view mode
  const { startIso, endIso } = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 })
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      return {
        startIso: toSupabaseTimestamptz(weekStart),
        endIso: toSupabaseTimestamptz(weekEnd),
      }
    } else {
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(24, 0, 0, 0)
      return {
        startIso: toSupabaseTimestamptz(dayStart),
        endIso: toSupabaseTimestamptz(dayEnd),
      }
    }
  }, [date, viewMode])

  // Refetch lessons with filters
  const refetchLessons = async () => {
    try {
      let data = await fetchLessons(supabase, { 
        start: startIso, 
        end: endIso, 
        teacherIds: selectedTeacherIds.length > 0 ? selectedTeacherIds : undefined
      })
      
      // Apply client-side filters
      if (filters.className) {
        data = data.filter(l => l.class_name && l.class_name.toLowerCase().includes(filters.className.toLowerCase()))
      }
      if (filters.status) {
        data = data.filter(l => l.status === filters.status)
      }
      
      setLessons(data)
    } catch (e) {
      setError('Не удалось загрузить расписание')
    }
  }

  useEffect(() => { 
    if (selectedTeacherIds.length || viewMode === 'week') {
      refetchLessons()
    }
  }, [startIso, endIso, selectedTeacherIds, filters.className, filters.status])

  // Navigation
  const gotoToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setDate(viewMode === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : d)
  }
  
  const gotoPrev = () => {
    if (viewMode === 'week') {
      const prevWeek = new Date(date)
      prevWeek.setDate(prevWeek.getDate() - 7)
      setDate(prevWeek)
    } else {
      setDate(prev => new Date(prev.getTime() - 24 * 60 * 60 * 1000))
    }
  }
  
  const gotoNext = () => {
    if (viewMode === 'week') {
      const nextWeek = new Date(date)
      nextWeek.setDate(nextWeek.getDate() + 7)
      setDate(nextWeek)
    } else {
      setDate(prev => new Date(prev.getTime() + 24 * 60 * 60 * 1000))
    }
  }

  const handleEmptySlotClick = ({ teacher, start, day, durationMin }) => {
    setEditing({ 
      teacher_id: teacher.id, 
      start_at: formatLocalDateTimeInput(start), 
      duration_min: durationMin || 60, 
      status: 'planned', 
      comment: '',
      class_name: '',
    })
    setInitialStartAt(start)
    setInitialDurationMin(durationMin || 60)
    setDrawerOpen(true)
  }

  const handleLessonClick = (l) => { 
    setEditing(l)
    setInitialStartAt(null)
    setInitialDurationMin(null)
    setDrawerOpen(true)
  }

  const handleSaved = () => { 
    refetchLessons()
    setDrawerOpen(false)
    setEditing(null)
    setInitialStartAt(null)
    setInitialDurationMin(null)
  }
  
  const handleDeleted = () => { 
    refetchLessons()
    setDrawerOpen(false)
    setEditing(null)
    setInitialStartAt(null)
    setInitialDurationMin(null)
  }

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  if (!isTeacher) return <div className="card p-6">Доступ запрещён</div>
  
  // Форматирование даты для заголовка
  const dateHeaderText = viewMode === 'week' 
    ? `${format(date, 'd MMMM', { locale: ru })} — ${format(new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000), 'd MMMM yyyy', { locale: ru })}`
    : format(date, 'd MMMM yyyy', { locale: ru })
  
  // Подсчёт активных и отменённых занятий
  const activeLessons = lessons.filter(l => l.status === 'planned' || l.status === 'done')
  const canceledLessons = lessons.filter(l => l.status === 'canceled')
  
  const activeCount = activeLessons.length
  const canceledCount = canceledLessons.length
  
  // Форматирование количества активных занятий
  const formatActiveCount = (count) => {
    if (count === 0) return 'нет занятий'
    if (count === 1) return '1 занятие'
    if (count < 5) return `${count} занятия`
    return `${count} занятий`
  }
  
  // Форматирование количества отменённых занятий
  const formatCanceledCount = (count) => {
    if (count === 1) return '1 отменено'
    return `${count} отменено`
  }
  
  // Формирование итогового текста статистики
  // Если фильтр по статусу = "Отменено", показываем только отменённые
  // Если фильтр по статусу = "Запланировано" или "Проведено", показываем только активные
  // Если фильтр пустой, показываем и активные, и отменённые (если есть)
  const isFilteredByCanceled = filters.status === 'canceled'
  const isFilteredByActive = filters.status === 'planned' || filters.status === 'done'
  
  let lessonsCountText
  if (isFilteredByCanceled) {
    // Показываем только отменённые
    lessonsCountText = canceledCount > 0 ? formatCanceledCount(canceledCount) : 'нет занятий'
  } else if (isFilteredByActive) {
    // Показываем только активные
    lessonsCountText = formatActiveCount(activeCount)
  } else {
    // Показываем и активные, и отменённые (если есть)
    lessonsCountText = canceledCount > 0
      ? `${formatActiveCount(activeCount)} · ${formatCanceledCount(canceledCount)}`
      : formatActiveCount(activeCount)
  }

  // Скелетон при загрузке
  const CalendarSkeleton = () => (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
      </div>
      <div className="border-t border-gray-200 p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader title="Календарь занятий" />
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: filters and controls */}
        <div className="card p-4 space-y-4">
          {/* View toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Вид</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'day' 
                    ? 'bg-brand text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => {
                  const newMode = 'day'
                  setViewMode(newMode)
                  const d = new Date()
                  d.setHours(0, 0, 0, 0)
                  setDate(d)
                }}
              >
                День
              </button>
              <button
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'week' 
                    ? 'bg-brand text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => {
                  const newMode = 'week'
                  setViewMode(newMode)
                  const d = new Date()
                  d.setHours(0, 0, 0, 0)
                  setDate(startOfWeek(d, { weekStartsOn: 1 }))
                }}
              >
                Неделя
              </button>
            </div>
          </div>

          {/* Date navigation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Дата</label>
            <input 
              type="date" 
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent mb-2" 
              value={formatDateOnlyYYYYMMDD(date)} 
              onChange={(e) => {
                const d = parseDateOnlyYYYYMMDD(e.target.value)
                if (d) {
                  setDate(viewMode === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : d)
                }
              }} 
            />
            <div className="flex items-center gap-2">
              <button 
                className="flex-1 rounded-xl px-3 py-2 text-sm border border-orange-300 text-orange-600 hover:bg-orange-50 font-medium transition-colors" 
                onClick={gotoToday}
              >
                Сегодня
              </button>
              <button 
                className="rounded-xl px-3 py-2 text-sm border border-orange-300 text-orange-600 hover:bg-orange-50 font-medium transition-colors" 
                onClick={gotoPrev}
              >
                ←
              </button>
              <button 
                className="rounded-xl px-3 py-2 text-sm border border-orange-300 text-orange-600 hover:bg-orange-50 font-medium transition-colors" 
                onClick={gotoNext}
              >
                →
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600 text-center">{dateHeaderText}</div>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Преподаватель</label>
              <select 
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={filters.teacher}
                onChange={(e) => {
                  const teacherId = e.target.value
                  updateFilter('teacher', teacherId)
                  if (teacherId) {
                    setSelectedTeacherIds([teacherId])
                  } else {
                    // Reset to all if admin, or self if teacher
                    if (isAdmin) {
                      setSelectedTeacherIds(teachers.map(t => t.id))
                    }
                  }
                }}
              >
                <option value="">Все</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.display_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Класс</label>
              <input 
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                type="text"
                value={filters.className}
                onChange={(e) => updateFilter('className', e.target.value)}
                placeholder="например: HSK1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select 
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
              >
                <option value="">Любой</option>
                <option value="planned">Запланировано</option>
                <option value="done">Проведено</option>
                <option value="canceled">Отменено</option>
              </select>
            </div>
          </div>

          {/* Teacher selection for admin (week view) */}
          {isAdmin && viewMode === 'week' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Преподаватели</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {teachers.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={selectedTeacherIds.includes(t.id)} 
                      onChange={(e) => {
                        setSelectedTeacherIds(prev => 
                          e.target.checked 
                            ? [...prev, t.id] 
                            : prev.filter(id => id !== t.id)
                        )
                      }} 
                    />
                    <span>{t.display_name ?? t.id}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: calendar grid */}
        <div className="lg:col-span-3">
          <div className="card p-4 space-y-3">
            {/* Заголовок с датой и количеством занятий + легенда */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {dateHeaderText} · {lessonsCountText}
              </div>
              {/* Легенда статусов */}
              <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-gray-200">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                  <span>Запланировано</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span>Проведено</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span>Отменено</span>
                </div>
              </div>
            </div>
            
            {loading ? (
              <CalendarSkeleton />
            ) : (
              <>
                {viewMode === 'day' ? (
                  <DayGrid
                    date={date}
                    teachers={teachers.filter(t => selectedTeacherIds.includes(t.id))}
                    lessons={lessons}
                    onEmptySlotClick={handleEmptySlotClick}
                    onLessonClick={handleLessonClick}
                  />
                ) : (
                  <WeekGrid
                    weekStart={date}
                    teachers={teachers.filter(t => selectedTeacherIds.includes(t.id))}
                    lessons={lessons}
                    onEmptySlotClick={handleEmptySlotClick}
                    onLessonClick={handleLessonClick}
                    currentDate={new Date()}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Event drawer (modal) */}
      <EventDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
          setInitialStartAt(null)
          setInitialDurationMin(null)
        }}
        date={date}
        teachers={teachers}
        students={students}
        editing={editing?.id ? editing : null}
        initialStartAt={initialStartAt}
        initialDurationMin={initialDurationMin}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
