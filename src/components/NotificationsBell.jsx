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
        className="relative rounded-full p-2 text-gray-700 hover:bg-gray-100"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        title="Уведомления"
      >
        {/* Bell icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 7 7.388 7 8.75V14.16c0 .538-.214 1.055-.595 1.435L5 17h5m5 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {badgeText && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-orange-600 text-white text-xs px-1.5 py-0.5 min-w-[1.25rem]">{badgeText}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border bg-white shadow-lg p-2 z-50">
          <div className="px-2 py-1 flex items-center justify-between">
            <div className="font-semibold">Уведомления</div>
            <button className="text-xs text-gray-600 hover:text-gray-800" onClick={onMarkAll}>Отметить всё прочитанным</button>
          </div>
          <div className="px-2 py-1 flex items-center gap-2">
            <button className={`rounded-lg px-2 py-1 text-sm ${filter === 'all' ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setFilter('all')}>Все</button>
            <button className={`rounded-lg px-2 py-1 text-sm ${filter === 'unread' ? 'bg-brand text-white' : 'bg-white border'}`} onClick={() => setFilter('unread')}>Непрочитанные</button>
          </div>
          <div className="mt-2 max-h-80 overflow-auto">
            <ul className="divide-y divide-gray-100">
              {filtered.map(n => (
                <li key={n.id} className="py-2 px-2 cursor-pointer hover:bg-gray-50" onClick={() => onClickItem(n)}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${typeColor(n.type)}`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'} text-gray-900`}>{n.title || '—'}</div>
                      {(n.body || '').trim() ? (
                        <div className="text-xs text-gray-600 mt-0.5 truncate">{n.body}</div>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">{formatShortDateTime(n.created_at)}</div>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-3 text-center text-sm text-gray-500">Нет уведомлений</li>
              )}
            </ul>
          </div>
          <div className="px-2 py-2">
            <button className="w-full rounded-lg px-3 py-2 text-sm bg-white border hover:bg-gray-50" onClick={() => { setOpen(false); navigate('/notifications') }}>Показать все</button>
          </div>
        </div>
      )}
    </div>
  )
}