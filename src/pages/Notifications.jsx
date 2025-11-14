import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import Section from '@/components/ui/Section'
import toast from '@/lib/safeToast'
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications'

function formatShortDateTime(input) {
  const d = new Date(input)
  if (isNaN(d.getTime())) return '—'
  const pad = (n) => (n < 10 ? `0${n}` : String(n))
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} в ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function typeColor(type) {
  if (type === 'assignment_checked') return 'bg-green-500'
  if (type === 'assignment_new') return 'bg-orange-500'
  return 'bg-gray-400'
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all') // all | unread
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  const unreadCount = useMemo(() => items.filter(n => !n.is_read).length, [items])

  const load = async (opts = {}) => {
    setLoading(true)
    const { data, error } = await getUserNotifications({ limit, offset, ...opts })
    if (error) {
      toast.error('Не удалось загрузить уведомления')
    }
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [limit, offset])

  const onMarkAll = async () => {
    const { error } = await markAllNotificationsRead()
    if (error) return toast.error('Не удалось отметить всё прочитанным')
    setItems(prev => prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })))
    toast.success('Все уведомления отмечены прочитанными')
  }

  const onClickItem = async (n) => {
    if (!n.is_read) {
      const { error } = await markNotificationRead(n.id)
      if (!error) {
        setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true, read_at: new Date().toISOString() } : i))
      }
    }
    if (n?.link_type && n?.link_id) {
      if (n.link_type === 'assignment') navigate(`/student/assignments/${n.link_id}`)
      if (n.link_type === 'lesson') navigate(`/lesson/${n.link_id}`)
    }
  }

  const filtered = useMemo(() => filter === 'unread' ? items.filter(n => !n.is_read) : items, [items, filter])

  return (
    <div className="space-y-6">
      <PageHeader title="Все уведомления" description="Список всех уведомлений вашего аккаунта" />

      <Section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button className={`rounded-lg px-2 py-1 ${filter === 'all' ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setFilter('all')}>Все</button>
            <button className={`rounded-lg px-2 py-1 ${filter === 'unread' ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setFilter('unread')}>Непрочитанные</button>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg px-3 py-2 text-sm bg-white border hover:bg-gray-50" onClick={onMarkAll}>Отметить всё прочитанным</button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Загрузка...</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(n => (
              <li key={n.id} className="py-3 px-2 cursor-pointer hover:bg-gray-50" onClick={() => onClickItem(n)}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full ${typeColor(n.type)}`} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'} text-gray-900`}>{n.title || '—'}</div>
                    {(n.body || '').trim() ? (
                      <div className="text-xs text-gray-600 mt-0.5">{n.body}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">{formatShortDateTime(n.created_at)}</div>
                </div>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="py-6 text-center text-sm text-gray-500">Нет уведомлений</li>
            )}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">Непрочитанных: {unreadCount}</div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg px-2 py-1 text-sm bg-white border" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>Назад</button>
            <button className="rounded-lg px-2 py-1 text-sm bg-white border" onClick={() => setOffset(o => o + limit)}>Вперёд</button>
          </div>
        </div>
      </Section>
    </div>
  )
}