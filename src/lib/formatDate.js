function pad(n) {
  return n < 10 ? `0${n}` : String(n)
}

export function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return input
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(input) {
  const d = toDate(input)
  if (!d) return '—'
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function formatDateTime(input) {
  const d = toDate(input)
  if (!d) return '—'
  const ddmmyyyy = formatDate(d)
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${ddmmyyyy} ${hh}:${min}`
}

export default {
  formatDate,
  formatDateTime,
}