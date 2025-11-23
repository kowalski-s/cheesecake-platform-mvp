import { useMemo } from 'react'
import LessonCard from './LessonCard'

// Константа высоты слота в пикселях (30 минут = 40px)
const SLOT_HEIGHT = 40
const SLOT_DURATION_MINUTES = 30

export default function DayGrid({ date, teachers = [], lessons = [], onEmptySlotClick = () => {}, onLessonClick = () => {} }) {
  // Build time slots from 08:00 to 22:00, 30min steps
  const slots = useMemo(() => {
    const start = new Date(date)
    start.setHours(8, 0, 0, 0)
    const end = new Date(date)
    end.setHours(22, 0, 0, 0)
    const arr = []
    let cur = new Date(start)
    while (cur < end) {
      arr.push(new Date(cur))
      cur = new Date(cur.getTime() + 30 * 60000)
    }
    return arr
  }, [date])

  const formatTime = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const toEnd = (l) => l.end_at ? new Date(l.end_at) : new Date(new Date(l.start_at).getTime() + ((l.duration_min || 60) * 60000))

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="grid grid-cols-[80px_repeat(var(--cols),1fr)] gap-0" style={{ ['--cols']: teachers.length || 1 }}>
          {/* Заголовок: пустая ячейка + заголовки преподавателей */}
          <div className="sticky top-0 z-20 bg-white border-b border-r border-gray-200 p-2"></div>
          {teachers.length > 0 ? teachers.map(t => (
            <div
              key={`header-${t.id}`}
              className="sticky top-0 z-20 bg-white border-b border-r border-gray-200 p-2 text-center text-sm font-medium text-gray-700 last:border-r-0"
            >
              {t.display_name || t.id}
            </div>
          )) : (
            <div className="sticky top-0 z-20 bg-white border-b border-r border-gray-200 p-2 text-center text-sm text-gray-500">
              Нет преподавателей
            </div>
          )}

          {/* Left time rail */}
          <div className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200" style={{ top: 0 }}>
            {slots.map((s, idx) => (
              <div 
                key={idx} 
                className="text-xs text-gray-500 flex items-start justify-end pr-2 border-b border-gray-200"
                style={{ height: `${SLOT_HEIGHT}px` }}
              >
                {s.getMinutes() === 0 && formatTime(s)}
              </div>
            ))}
          </div>

          {/* Columns per teacher */}
          {teachers.length > 0 ? teachers.map(t => {
            const teacherLessons = (lessons || []).filter(l => l.teacher_id === t.id)
            return (
              <div key={t.id} className="relative border-r border-gray-200 last:border-r-0">
                {/* Empty slots overlay clickable */}
                {slots.map((s, idx) => (
                  <div
                    key={idx}
                    className="border-b border-gray-100 hover:bg-orange-50/30 cursor-pointer transition-colors"
                    style={{ height: `${SLOT_HEIGHT}px` }}
                    onClick={() => onEmptySlotClick({ teacher: t, start: s, durationMin: SLOT_DURATION_MINUTES })}
                  />
                ))}
                
                {/* Lessons rendered as positioned blocks */}
                {teacherLessons.map(l => {
                  const s = new Date(l.start_at)
                  const e = toEnd(l)
                  const dayStart = new Date(date)
                  dayStart.setHours(8, 0, 0, 0)
                  
                  // Вычисляем смещение в минутах от начала дня
                  const dayStartMinutes = 8 * 60 // 08:00 = 480 минут
                  const lessonStartMinutes = s.getHours() * 60 + s.getMinutes()
                  const lessonEndMinutes = e.getHours() * 60 + e.getMinutes()
                  
                  const offsetMinutes = Math.max(0, lessonStartMinutes - dayStartMinutes)
                  const durationMinutes = Math.max(lessonEndMinutes - lessonStartMinutes, 15)
                  
                  // Вычисляем позицию в пикселях
                  const top = (offsetMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
                  const height = (durationMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
                  
                  return (
                    <div
                      key={l.id}
                      className="absolute left-1 right-1 z-20"
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onClick={(ev) => { ev.stopPropagation(); onLessonClick(l) }}
                    >
                      <LessonCard lesson={l} onClick={onLessonClick} />
                    </div>
                  )
                })}
              </div>
            )
          }) : (
            <div className="relative border-r border-gray-200">
              {slots.map((s, idx) => (
                <div 
                  key={idx} 
                  className="border-b border-gray-100"
                  style={{ height: `${SLOT_HEIGHT}px` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
