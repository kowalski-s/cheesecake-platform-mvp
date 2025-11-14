// Ленивая привязка к глобальному инстансу тостов.
// Важно: не кэшируем методы на момент импорта, чтобы работать,
// даже если AppToaster монтируется позже и инициализирует window.__toast.
function call(kind, msg, opts) {
  try {
    if (typeof window !== 'undefined' && window.__toast && typeof window.__toast[kind] === 'function') {
      return window.__toast[kind](msg, opts)
    }
    // fallback: молча игнорируем, чтобы вызов не ломал логику
  } catch (_) {
    // ignore
  }
}

export const toast = {
  success: (msg, opts) => call('success', msg, opts),
  error:   (msg, opts) => call('error', msg, opts),
  info:    (msg, opts) => call('info', msg, opts),
}

export default toast