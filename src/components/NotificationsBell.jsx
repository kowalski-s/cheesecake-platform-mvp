import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import toast from '@/lib/safeToast'
import { supabase } from '@/lib/supabaseClient'
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, subscribeToNotifications } from '@/lib/notifications'

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

export default function NotificationsBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const unreadCount = useMemo(() => items.filter(n => !n.is_read).length, [items])
  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return null
    return unreadCount > 9 ? '9+' : String(unreadCount)
  }, [unreadCount])

  // Close on outside click / Escape
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [])

  // Initial load
  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!user) return
      setLoading(true)
      const { data } = await getUserNotifications({ limit: 20, offset: 0 })
      if (alive) setItems(data || [])
      setLoading(false)
    }
    run()
    return () => { alive = false }
  }, [user])

  // Realtime subscription: toast + update list/counter
  useEffect(() => {
    let channel
    const sub = async () => {
      channel = await subscribeToNotifications((n) => {
        // Show toast based on type
        const title = n?.title || 'Новое уведомление'
        const body = (n?.body || '').trim()
        if (n?.type === 'assignment_checked') {
          toast.success(title, { description: body || undefined })
        } else if (n?.type === 'assignment_new') {
          toast.info(title, { description: body || undefined })
        } else {
          toast.info(title, { description: body || undefined })
        }
        // Insert into list at top
        setItems(prev => [n, ...prev].slice(0, 20))
      })
    }
    sub()
    return () => {
      try { channel && supabase?.removeChannel && supabase.removeChannel(channel) } catch {}
    }
  }, [])

  const onMarkAll = async () => {
    const { error } = await markAllNotificationsRead()
    if (error) return toast.error('Не удалось отметить всё прочитанным')
    setItems(prev => prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })))
  }

  const onClickItem = async (n) => {
    // Mark read
    if (!n.is_read) {
      const { error } = await markNotificationRead(n.id)
      if (!error) {
        setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true, read_at: new Date().toISOString() } : i))
      }
    }
    // Navigate by link_type/id
    if (n?.link_type && n?.link_id) {
      if (n.link_type === 'assignment') navigate(`/student/assignments/${n.link_id}`)
      if (n.link_type === 'lesson') navigate(`/lesson/${n.link_id}`)
      setOpen(false)
    }
  }

  const filtered = useMemo(() => {
    return filter === 'unread' ? items.filter(n => !n.is_read) : items
  }, [items, filter])

  return (
    <div className="relative" ref={ref}>
      <button
        className={`relative rounded-full p-2 transition-all duration-200 cursor-pointer ${
          unreadCount > 0 
            ? 'text-orange-400 hover:bg-orange-50' 
            : 'text-gray-400 hover:bg-gray-100'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)'
          setTimeout(() => {
            e.currentTarget.style.transform = 'scale(1)'
          }, 150)
          setOpen(v => !v)
        }}
        title="Уведомления"
      >
        {/* Bell icon - более тонкая */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {badgeText && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-semibold px-1.5 py-0.5 min-w-[18px] h-[18px] shadow-sm">
            {badgeText}
          </span>
        )}
      </button>
      {open && (
        <div 
          className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-slate-50 shadow-lg z-50 overflow-hidden"
          style={{
            animation: 'fadeIn 0.15s ease-out forwards'
          }}
        >
          <div className="px-4 py-3 space-y-3">
            {/* Шапка попапа */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[15px] text-gray-900 mb-0.5">Уведомления</div>
                <div className="text-[11px] text-gray-500">
                  {unreadCount > 0 
                    ? `Сегодня у вас ${unreadCount} ${unreadCount === 1 ? 'новое уведомление' : unreadCount < 5 ? 'новых уведомления' : 'новых уведомлений'}`
                    : 'Новых уведомлений нет'
                  }
                </div>
              </div>
              <button 
                className="text-[12px] text-gray-600 hover:text-gray-900 hover:underline transition-colors whitespace-nowrap" 
                onClick={onMarkAll}
              >
                Отметить всё прочитанным
              </button>
            </div>

            {/* Табы */}
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

            {/* Список уведомлений */}
            <div className="max-h-80 overflow-y-auto -mx-4 px-4">
              {loading ? (
                <div className="py-4 text-center text-sm text-gray-500">Загрузка...</div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">Нет уведомлений</div>
              ) : (
                <div className="space-y-1">
                  {filtered.map(n => (
                    <div 
                      key={n.id} 
                      className="flex justify-between items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => onClickItem(n)}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Индикатор состояния */}
                        {!n.is_read ? (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" aria-hidden />
                        ) : (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-gray-300 flex-shrink-0" aria-hidden />
                        )}
                        
                        {/* Текстовая часть */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${!n.is_read ? 'font-medium' : 'font-normal'} text-gray-900`}>
                            {n.title || '—'}
                          </div>
                          {(n.body || '').trim() ? (
                            <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                          ) : null}
                        </div>
                      </div>
                      
                      {/* Время */}
                      <div className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatShortDateTime(n.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Кнопка "Посмотреть все уведомления" */}
            <button 
              className="w-full rounded-full border border-gray-200 py-2 px-4 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium" 
              onClick={() => { setOpen(false); navigate('/notifications') }}
            >
              Посмотреть все уведомления
            </button>
          </div>
        </div>
      )}
    </div>
  )
}