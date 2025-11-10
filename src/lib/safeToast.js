const noop = () => {}

// допустимый API — только методы: success/error/info
export const toast = {
  success: (typeof window !== 'undefined' && window.__toast && typeof window.__toast.success === 'function') ? window.__toast.success : noop,
  error:   (typeof window !== 'undefined' && window.__toast && typeof window.__toast.error   === 'function') ? window.__toast.error   : noop,
  info:    (typeof window !== 'undefined' && window.__toast && typeof window.__toast.info    === 'function') ? window.__toast.info    : noop,
}

export default toast