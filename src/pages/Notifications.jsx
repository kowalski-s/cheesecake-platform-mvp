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
      <PageHeader 
        title="Все уведомления" 
        description="Здесь хранятся все уведомления за последние 30 дней." 
      />

      <Section>
        {/* Фильтры */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button 
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-orange-50 text-orange-500 border border-orange-200' 
                  : 'bg-transparent text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`} 
              onClick={() => setFilter('all')}
            >
              Все
            </button>
            <button 
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === 'unread' 
                  ? 'bg-orange-50 text-orange-500 border border-orange-200' 
                  : 'bg-transparent text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`} 
              onClick={() => setFilter('unread')}
            >
              Непрочитанные
            </button>
          </div>
          <button 
            className="rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors" 
            onClick={onMarkAll}
          >
            Отметить всё прочитанным
          </button>
        </div>

        {/* Список уведомлений */}
        {loading ? (
          <div className="py-12 text-center text-gray-500">Загрузка...</div>
        ) : filtered.length === 0 ? (
          /* Пустое состояние */
          <div className="py-16 text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 mx-auto mb-4 text-gray-200" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              strokeWidth={1}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">У вас пока нет уведомлений</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Как только появятся новые ДЗ или изменения в расписании — они появятся здесь.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => (
              <div 
                key={n.id} 
                className="w-full rounded-xl px-4 py-3 mb-2 cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => onClickItem(n)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Индикатор состояния */}
                    {!n.is_read ? (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" aria-hidden />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 rounded-full border border-gray-300 flex-shrink-0" aria-hidden />
                    )}
                    
                    {/* Текстовая часть */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${!n.is_read ? 'font-medium text-gray-900' : 'font-normal text-gray-500'}`}>
                        {n.title || '—'}
                      </div>
                      {(n.body || '').trim() ? (
                        <div className={`text-xs mt-0.5 ${!n.is_read ? 'text-gray-600' : 'text-gray-400'}`}>
                          {n.body}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Время */}
                  <div className={`text-[11px] whitespace-nowrap flex-shrink-0 ${!n.is_read ? 'text-gray-400' : 'text-gray-300'}`}>
                    {formatShortDateTime(n.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Пагинация */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">Непрочитанных: {unreadCount}</div>
            <div className="flex items-center gap-2">
              <button 
                className="rounded-lg px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={offset === 0} 
                onClick={() => setOffset(o => Math.max(0, o - limit))}
              >
                Назад
              </button>
              <button 
                className="rounded-lg px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors" 
                onClick={() => setOffset(o => o + limit)}
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}