import { format } from 'date-fns'

export default function LessonCard({ lesson, onClick }) {
  const start = new Date(lesson.start_at)
  const end = lesson.end_at ? new Date(lesson.end_at) : new Date(start.getTime() + ((lesson.duration_min || 60) * 60000))
  
  const formatTime = (d) => format(d, 'HH:mm')
  const timeStr = `${formatTime(start)}–${formatTime(end)}`
  
  // Цвета полоски по статусу
  const statusBorderColors = {
    planned: 'border-l-orange-400',
    done: 'border-l-green-400',
    canceled: 'border-l-gray-400',
  }
  
  const borderColor = statusBorderColors[lesson.status] || statusBorderColors.planned
  
  // Обрезаем длинные названия
  const title = lesson.title || '(без названия)'
  const displayTitle = title.length > 30 ? `${title.substring(0, 27)}...` : title
  
  return (
    <div
      className={`bg-white border-l-2 ${borderColor} rounded-xl p-2 text-xs cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${lesson.status === 'canceled' ? 'opacity-70 line-through' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) onClick(lesson)
      }}
      title={title}
    >
      <div className="font-bold text-gray-900 mb-0.5">{displayTitle}</div>
      <div className="text-gray-500 text-[10px] mb-0.5">{timeStr}</div>
      <div className="text-gray-500 text-[10px]">
        {lesson.class_name && <span className="mr-1">{lesson.class_name}</span>}
        {lesson.student?.display_name && <span>• {lesson.student.display_name}</span>}
      </div>
      {lesson.status === 'done' && (
        <span className="inline-block mt-1 text-green-600">✓</span>
      )}
    </div>
  )
}

