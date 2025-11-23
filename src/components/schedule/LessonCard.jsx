import { format } from 'date-fns'

export default function LessonCard({ lesson, onClick }) {
  const start = new Date(lesson.start_at)
  const end = lesson.end_at ? new Date(lesson.end_at) : new Date(start.getTime() + ((lesson.duration_min || 60) * 60000))
  
  const formatTime = (d) => format(d, 'HH:mm')
  const timeStr = `${formatTime(start)}–${formatTime(end)}`
  
  // Цвета по статусу в стиле Cheesecake (светлая тема)
  const statusStyles = {
    planned: 'bg-orange-50 border-l-4 border-orange-400 hover:bg-orange-100',
    done: 'bg-green-50 border-l-4 border-green-400 hover:bg-green-100',
    canceled: 'bg-gray-100 border-l-4 border-gray-400 line-through opacity-70',
  }
  
  const style = statusStyles[lesson.status] || statusStyles.planned
  
  // Обрезаем длинные названия
  const title = lesson.title || '(без названия)'
  const displayTitle = title.length > 30 ? `${title.substring(0, 27)}...` : title
  
  return (
    <div
      className={`rounded-lg p-2 text-xs cursor-pointer transition-colors shadow-sm ${style}`}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) onClick(lesson)
      }}
      title={title}
    >
      <div className="font-medium text-gray-900 mb-0.5">{displayTitle}</div>
      <div className="text-gray-600 text-[10px] mb-0.5">{timeStr}</div>
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

