import { useMemo } from 'react'

export default function DayGrid({ date, teachers = [], lessons = [], onEmptySlotClick = () => {}, onLessonClick = () => {} }) {
  // Build time slots from 09:00 to 22:00, 30min steps
  const slots = useMemo(() => {
    const start = new Date(date)
    start.setHours(9, 0, 0, 0)
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
  const toEnd = (l) => l.end_at ? new Date(l.end_at) : new Date(new Date(l.start_at).getTime() + ((l.duration_min || 0) * 60000))

  return (
    <div className="grid grid-cols-[100px_repeat(var(--cols),1fr)] gap-2" style={{ ['--cols']: teachers.length }}>
      {/* Left time rail */}
      <div className="relative">
        {slots.map((s, idx) => (
          <div key={idx} className="h-10 text-xs text-gray-500 flex items-start">{formatTime(s)}</div>
        ))}
      </div>

      {/* Columns per teacher */}
      {teachers.map(t => {
        const teacherLessons = (lessons || []).filter(l => l.teacher_id === t.id)
        return (
          <div key={t.id} className="relative border-l">
            {/* Empty slots overlay clickable */}
            {slots.map((s, idx) => (
              <div
                key={idx}
                className="h-10 hover:bg-orange-50 cursor-pointer"
                onClick={() => onEmptySlotClick({ teacher: t, start: s })}
              />
            ))}
            {/* Lessons rendered as positioned blocks */}
            {teacherLessons.map(l => {
              const s = new Date(l.start_at)
              const e = toEnd(l)
              const dayStart = new Date(date); dayStart.setHours(9,0,0,0)
              const dayEnd = new Date(date); dayEnd.setHours(22,0,0,0)
              const totalMs = dayEnd - dayStart
              const topPct = Math.max(0, (s - dayStart) / totalMs * 100)
              const heightPct = Math.max(3, (e - s) / totalMs * 100)
              const statusColor = l.status === 'done' ? 'bg-green-200' : l.status === 'canceled' ? 'bg-gray-300 line-through' : 'bg-orange-200'
              return (
                <div
                  key={l.id}
                  className={`absolute left-2 right-2 rounded p-1 text-xs shadow ${statusColor}`}
                  style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                  onClick={(ev) => { ev.stopPropagation(); onLessonClick(l) }}
                >
                  <div className="font-medium">{l.student?.display_name ?? '—'}</div>
                  <div className="opacity-70">{formatTime(s)}–{formatTime(e)}</div>
                  {l.status === 'done' && <span className="inline-block mt-1">✔</span>}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}