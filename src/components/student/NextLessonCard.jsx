import { formatDateTime } from '../../lib/formatDate'

export default function NextLessonCard({ lesson, teacherName }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Ближайший урок</h2>

      {!lesson ? (
        <div className="text-sm text-gray-600">У вас пока нет запланированных занятий</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Дата и время</span>
            <span className="font-medium">{formatDateTime(lesson.start_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Статус</span>
            <span className="inline-flex items-center rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{lesson.status || 'planned'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Длительность</span>
            <span className="font-medium">{typeof lesson.duration === 'number' ? `${lesson.duration} мин` : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Преподаватель</span>
            <span className="font-medium">{teacherName || '—'}</span>
          </div>
          {lesson.title && (
            <div className="pt-1 text-sm text-gray-600">{lesson.title}{lesson.class_name ? ` • ${lesson.class_name}` : ''}</div>
          )}
        </div>
      )}
    </section>
  )
}