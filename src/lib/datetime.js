function pad(n) {
  return n < 10 ? `0${n}` : String(n)
}

export function formatDateOnlyYYYYMMDD(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  return `${y}-${m}-${dd}`
}

export function parseDateOnlyYYYYMMDD(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(v => parseInt(v, 10))
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  dt.setHours(0, 0, 0, 0)
  return dt
}

export function formatLocalDateTimeInput(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${y}-${m}-${dd}T${hh}:${mm}`
}

export function parseLocalDateTimeInput(str) {
  if (!str) return null
  const [datePart, timePart] = str.split('T')
  if (!datePart || !timePart) return null
  const [y, m, d] = datePart.split('-').map(v => parseInt(v, 10))
  const [hh, mm] = timePart.split(':').map(v => parseInt(v, 10))
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return null
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

export function toSupabaseTimestamptz(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  const offsetMin = -d.getTimezoneOffset() // local offset minutes relative to UTC
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = pad(Math.floor(abs / 60))
  const om = pad(abs % 60)
  return `${y}-${m}-${dd} ${hh}:${mm}:${ss}${sign}${oh}:${om}`
}

export function addMinutes(date, minutes) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return null
  return new Date(d.getTime() + (minutes || 0) * 60000)
}

export default {
  formatDateOnlyYYYYMMDD,
  parseDateOnlyYYYYMMDD,
  formatLocalDateTimeInput,
  parseLocalDateTimeInput,
  toSupabaseTimestamptz,
  addMinutes,
}