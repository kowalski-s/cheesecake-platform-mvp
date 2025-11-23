import React, { useMemo, useEffect, useState } from 'react'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import LessonCard from './LessonCard'

// Константа высоты слота в пикселях (30 минут = 48px)
const SLOT_HEIGHT = 48
const SLOT_DURATION_MINUTES = 30

// Русские сокращения дней недели
const WEEKDAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function getWeekdayLabel(date) {
  const day = date.getDay() // 0-вс ... 6-сб
  return WEEKDAY_LABELS[day]
}

export default function WeekGrid({ weekStart, teachers = [], lessons = [], onEmptySlotClick = () => {}, onLessonClick = () => {}, currentDate = null }) {
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Обновляем текущее время каждую минуту
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])
  // Генерируем 7 дней недели
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 }) // Понедельник
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekStart])

  // Временные слоты: 09:00-21:00 с шагом 30 минут
  const timeSlots = useMemo(() => {
    const slots = []
    for (let h = 9; h < 21; h++) {
      slots.push({ hour: h, minute: 0 })
      slots.push({ hour: h, minute: 30 })
    }
    return slots
  }, [])
  
  // Проверяем, какой день является активным (сегодня)
  const getIsActiveDay = (day) => {
    if (!currentDate) return false
    const today = new Date(currentDate)
    today.setHours(0, 0, 0, 0)
    const checkDay = new Date(day)
    checkDay.setHours(0, 0, 0, 0)
    return today.getTime() === checkDay.getTime()
  }
  
  // Проверяем, содержит ли неделя сегодняшний день
  const weekContainsToday = useMemo(() => {
    if (!currentDate) return false
    return weekDays.some(day => isSameDay(day, currentDate))
  }, [weekDays, currentDate])
  
  // Вычисляем позицию линии текущего времени для активного дня
  const getCurrentTimePosition = (day) => {
    if (!weekContainsToday || !isSameDay(day, currentTime)) return null
    const now = currentTime
    const dayStart = new Date(day)
    dayStart.setHours(9, 0, 0, 0)
    
    const dayStartMinutes = 9 * 60 // 09:00 = 540 минут
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    if (currentMinutes < dayStartMinutes || currentMinutes >= 21 * 60) return null
    
    const offsetMinutes = currentMinutes - dayStartMinutes
    const top = (offsetMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
    return top
  }

  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  
  // Вычисляем end_at для урока (та же логика, что в DayGrid)
  const toEnd = (l) => {
    if (l.end_at) return new Date(l.end_at)
    const start = new Date(l.start_at)
    return new Date(start.getTime() + ((l.duration_min || 60) * 60000))
  }

  // Получаем уроки для конкретного дня
  const getLessonsForDay = (day) => {
    return (lessons || []).filter(l => {
      const lessonDate = new Date(l.start_at)
      return isSameDay(lessonDate, day)
    })
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-0" style={{ backgroundColor: '#fcfcfc' }}>
          {/* Заголовок: пустая ячейка + дни недели */}
          <div className="sticky top-0 z-20 bg-white border-b border-r border-slate-200/40 p-2"></div>
          {weekDays.map((day, idx) => {
            const isActive = getIsActiveDay(day)
            return (
              <div
                key={`header-${idx}`}
                className={`sticky top-0 z-20 bg-white border-b border-r border-slate-200/40 p-2 text-center ${isActive ? 'bg-[#fff8f3]' : ''}`}
              >
                <div className="text-xs font-medium text-gray-700">
                  {getWeekdayLabel(day)}
                </div>
                <div className="text-xs text-gray-500">
                  {format(day, 'd.MM')}
                </div>
              </div>
            )
          })}

          {/* Временная шкала (столбик слева) */}
          <div className="sticky left-0 z-10 bg-white/50 border-r border-slate-200/40" style={{ top: 0 }}>
            {timeSlots.map((slot, slotIdx) => (
              <div 
                key={`time-${slotIdx}`}
                className="text-xs text-gray-500 flex items-start justify-end pr-2 border-b border-slate-200/40"
                style={{ height: `${SLOT_HEIGHT}px` }}
              >
                {slot.minute === 0 && formatTime(slot.hour, slot.minute)}
              </div>
            ))}
          </div>

          {/* Колонки для каждого дня недели */}
          {weekDays.map((day, dayIdx) => {
            const dayLessons = getLessonsForDay(day)
            const isActive = getIsActiveDay(day)
            const currentTimePos = getCurrentTimePosition(day)
            
            return (
              <div 
                key={`day-${dayIdx}`}
                className={`relative border-r border-slate-200/40 last:border-r-0 ${isActive ? 'bg-[#fff8f3]' : ''}`}
              >
                {/* Линия текущего времени */}
                {currentTimePos !== null && (
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none"
                    style={{ top: `${currentTimePos}px` }}
                  >
                    <div className="relative">
                      <div className="absolute left-0 right-0 h-0.5 bg-orange-400"></div>
                      <div className="absolute left-0 top-0 w-2 h-2 -translate-x-1 -translate-y-1 rounded-full bg-orange-400"></div>
                    </div>
                  </div>
                )}
                
                {/* Кликабельные слоты для этого дня */}
                {timeSlots.map((slot, slotIdx) => {
                  const clickTime = new Date(day)
                  clickTime.setHours(slot.hour, slot.minute, 0, 0)
                  
                  return (
                    <div
                      key={`slot-${dayIdx}-${slotIdx}`}
                      className="border-b border-slate-200/40 hover:bg-orange-50/30 transition-colors cursor-pointer"
                      style={{ height: `${SLOT_HEIGHT}px` }}
                      onClick={() => {
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
                  )
                })}
                
                {/* Уроки для этого дня (абсолютно позиционированные) */}
                {dayLessons.map(lesson => {
                  const s = new Date(lesson.start_at)
                  const e = toEnd(lesson)
                  
                  // Вычисляем смещение в минутах от начала дня (та же логика, что в DayGrid)
                  const dayStartMinutes = 9 * 60 // 09:00 = 540 минут
                  const lessonStartMinutes = s.getHours() * 60 + s.getMinutes()
                  const lessonEndMinutes = e.getHours() * 60 + e.getMinutes()
                  
                  const offsetMinutes = Math.max(0, lessonStartMinutes - dayStartMinutes)
                  const durationMinutes = Math.max(lessonEndMinutes - lessonStartMinutes, 15)
                  
                  // Вычисляем позицию в пикселях (та же логика, что в DayGrid)
                  const top = (offsetMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
                  const height = (durationMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT
                  
                  return (
                    <div
                      key={lesson.id}
                      className="absolute z-20"
                      style={{ top: `${top}px`, height: `${height}px`, left: '4px', right: '4px' }}
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
