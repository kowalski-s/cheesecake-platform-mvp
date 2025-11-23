import React, { useMemo } from 'react'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import LessonCard from './LessonCard'

// Константа высоты слота в пикселях (30 минут = 40px)
const SLOT_HEIGHT = 40
const SLOT_DURATION_MINUTES = 30

// Русские сокращения дней недели
const WEEKDAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function getWeekdayLabel(date) {
  const day = date.getDay() // 0-вс ... 6-сб
  return WEEKDAY_LABELS[day]
}

export default function WeekGrid({ weekStart, teachers = [], lessons = [], onEmptySlotClick = () => {}, onLessonClick = () => {} }) {
  // Генерируем 7 дней недели
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 }) // Понедельник
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekStart])

  // Временные слоты: 08:00-22:00 с шагом 30 минут
  const timeSlots = useMemo(() => {
    const slots = []
    for (let h = 8; h < 22; h++) {
      slots.push({ hour: h, minute: 0 })
      slots.push({ hour: h, minute: 30 })
    }
    return slots
  }, [])

  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  
  // Вычисляем end_at для урока
  const toEnd = (l) => {
    if (l.end_at) return new Date(l.end_at)
    const start = new Date(l.start_at)
    return new Date(start.getTime() + ((l.duration_min || 60) * 60000))
  }

  // Получаем уроки для конкретного дня (всех выбранных преподавателей)
  const getLessonsForDay = (day) => {
    return (lessons || []).filter(l => {
      const lessonDate = new Date(l.start_at)
      return isSameDay(lessonDate, day)
    })
  }

  // Вычисляем позицию и высоту карточки урока в пикселях (та же логика, что в DayGrid)
  const getLessonPosition = (lesson, dayStart) => {
    const start = new Date(lesson.start_at)
    const end = toEnd(lesson)
    const dayStartDate = new Date(dayStart)
    dayStartDate.setHours(8, 0, 0, 0)
    
    // Вычисляем смещение в минутах от начала дня
    const dayStartMinutes = 8 * 60 // 08:00 = 480 минут
    const lessonStartMinutes = start.getHours() * 60 + start.getMinutes()
    const lessonEndMinutes = end.getHours() * 60 + end.getMinutes()
    
    const offsetMinutes = Math.max(0, lessonStartMinutes - dayStartMinutes)
    const durationMinutes = Math.max(lessonEndMinutes - lessonStartMinutes, 15)
    
    // Вычисляем позицию в пикселях
    const top = (offsetMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
    const height = (durationMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
    
    return { top: `${top}px`, height: `${height}px` }
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-0">
          {/* Заголовок: пустая ячейка + дни недели */}
          <div className="sticky top-0 z-10 bg-white border-b border-r border-gray-200 p-2"></div>
          {weekDays.map((day, idx) => (
            <div
              key={idx}
              className="sticky top-0 z-10 bg-white border-b border-r border-gray-200 p-2 text-center"
            >
              <div className="text-xs font-medium text-gray-700">
                {getWeekdayLabel(day)}
              </div>
              <div className="text-xs text-gray-500">
                {format(day, 'd.MM')}
              </div>
            </div>
          ))}

          {/* Временная шкала + сетка слотов (без карточек) */}
          {timeSlots.map((slot, slotIdx) => (
            <React.Fragment key={slotIdx}>
              {/* Временная метка */}
              <div 
                className="border-r border-b border-gray-200 p-1 text-xs text-gray-500 text-right pr-2 bg-gray-50"
                style={{ height: `${SLOT_HEIGHT}px` }}
              >
                {slot.minute === 0 && formatTime(slot.hour, slot.minute)}
              </div>
              
              {/* Колонки для каждого дня - только фон/линии сетки (без карточек) */}
              {weekDays.map((day, dayIdx) => (
                <div
                  key={`${slotIdx}-${dayIdx}`}
                  className="border-r border-b border-gray-200 hover:bg-orange-50/30 transition-colors cursor-pointer"
                  style={{ height: `${SLOT_HEIGHT}px` }}
                  onClick={() => {
                    const clickTime = new Date(day)
                    clickTime.setHours(slot.hour, slot.minute, 0, 0)
                    // Используем первого преподавателя из списка
                    const teacher = teachers[0]
                    if (teacher) {
                      onEmptySlotClick({ 
                        teacher, 
                        start: clickTime, 
                        day,
                        durationMin: SLOT_DURATION_MINUTES
                      })
                    }
                  }}
                />
              ))}
            </React.Fragment>
          ))}

          {/* Отдельный проход: карточки уроков для каждого дня (вне цикла по тайм-слотам) */}
          {weekDays.map((day, dayIdx) => {
            const dayLessons = getLessonsForDay(day)
            if (dayLessons.length === 0) return null
            
            // Колонка дня начинается с колонки 2 (колонка 1 = временная шкала)
            const gridColumn = dayIdx + 2
            // Строки начинаются с 2 (строка 1 = заголовок), заканчиваются после всех тайм-слотов
            const gridRowStart = 2
            const gridRowEnd = timeSlots.length + 2
            
            return (
              <div
                key={`lessons-${dayIdx}`}
                className="absolute"
                style={{
                  gridColumn: gridColumn,
                  gridRow: `${gridRowStart} / ${gridRowEnd}`,
                  top: '40px', // высота заголовка
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <div className="relative h-full" style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}>
                  {dayLessons.map(lesson => {
                    const pos = getLessonPosition(lesson, day)
                    return (
                      <div
                        key={lesson.id}
                        className="absolute left-1 right-1 z-20"
                        style={{ top: pos.top, height: pos.height }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onLessonClick(lesson)
                        }}
                      >
                        <LessonCard lesson={lesson} onClick={onLessonClick} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
