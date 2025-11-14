import { useEffect, useRef, useState } from 'react'

// Unified toaster anchored bottom-right with Tailwind styles already used in project
export default function AppToaster() {
  const [items, setItems] = useState([])
  const timersRef = useRef({})

  const remove = (id) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const tm = timersRef.current[id]
    if (tm) { clearTimeout(tm); delete timersRef.current[id] }
  }

  const push = (type, message, options = {}) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const duration = typeof options.duration === 'number' ? options.duration : 4500
    const title = options.title || (type === 'success' ? 'Успешно' : type === 'error' ? 'Ошибка' : 'Инфо')
    const description = options.description || ''
    const item = { id, type, title, message: message || '', description }
    setItems((prev) => [...prev, item])
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => remove(id), duration)
    }
  }

  useEffect(() => {
    // expose global API compatible with src/lib/safeToast.js
    if (typeof window !== 'undefined') {
      window.__toast = {
        success: (msg, opts) => push('success', msg, opts),
        error: (msg, opts) => push('error', msg, opts),
        info: (msg, opts) => push('info', msg, opts),
      }
    }
    return () => {
      if (typeof window !== 'undefined' && window.__toast) {
        // eslint-disable-next-line no-undef
        delete window.__toast
      }
    }
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-full flex-col items-end gap-2 sm:bottom-6 sm:right-6 sm:left-auto left-3 right-3">
      {items.map((t) => (
        <ToastItem key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ item, onClose }) {
  const { type, title, message, description } = item
  const palette = paletteByType(type)
  return (
    <div className="pointer-events-auto relative w-full sm:w-[380px] max-w-[480px]">
      <div className="relative overflow-hidden rounded-xl bg-white shadow-soft border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: palette.stripe }} />
        <div className="flex items-start gap-3 p-3 pr-8">
          <div className="mt-0.5 shrink-0" aria-hidden>
            {iconByType(type, palette.icon)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            {(message || description) && (
              <div className="mt-0.5 text-sm text-gray-600">
                {message}
                {description ? (<div className="mt-0.5">{description}</div>) : null}
              </div>
            )}
          </div>
          <button
            type="button"
            className="absolute right-2 top-2 rounded-md p-1 text-gray-400 hover:text-gray-600"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function paletteByType(type) {
  switch (type) {
    case 'success':
      return { stripe: '#f78c1f', icon: '#f78c1f' } // brand orange
    case 'error':
      return { stripe: '#ec6a5e', icon: '#ec6a5e' } // soft reddish
    case 'info':
    default:
      return { stripe: '#5b7c99', icon: '#5b7c99' } // muted blue/gray
  }
}

function iconByType(type, color) {
  const common = { width: 20, height: 20, style: { color } }
  switch (type) {
    case 'success':
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )
    case 'error':
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    case 'info':
    default:
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="8" />
        </svg>
      )
  }
}