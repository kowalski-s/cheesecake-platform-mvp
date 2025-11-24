import { startOfWeek, endOfWeek, subDays, subWeeks, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'

/**
 * Вычисляет диапазон дат для выбранного периода (календарные периоды)
 * @param {string} period - 'week' | 'month' | 'all' | 'custom'
 * @param {Date} baseDate - базовая дата для расчёта (по умолчанию сегодня)
 * @param {Date} customFrom - для 'custom'
 * @param {Date} customTo - для 'custom'
 * @returns {{ from: string | null, to: string | null }} - ISO строки для Supabase или null
 */
export function calculatePeriodRange(period, baseDate = null, customFrom = null, customTo = null) {
  const date = baseDate || new Date()
  
  switch (period) {
    case 'week': {
      // Календарная неделя: понедельник - воскресенье
      const from = startOfDay(startOfWeek(date, { weekStartsOn: 1 }))
      const to = endOfDay(endOfWeek(date, { weekStartsOn: 1 }))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
      }
    }
    
    case 'month': {
      // Календарный месяц: первое число - последнее число
      const from = startOfDay(startOfMonth(date))
      const to = endOfDay(endOfMonth(date))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
      }
    }
    
    case 'custom': {
      if (!customFrom || !customTo) {
        return { from: null, to: null }
      }
      const from = startOfDay(customFrom)
      const to = endOfDay(customTo)
      return {
        from: from.toISOString(),
        to: to.toISOString(),
      }
    }
    
    case 'all':
    default:
      return { from: null, to: null }
  }
}

/**
 * Вычисляет диапазон дат для предыдущего периода
 * @param {string} period - 'week' | 'month' | 'all' | 'custom'
 * @param {Date} baseDate - базовая дата для расчёта
 * @param {Date} customFrom - для 'custom' (текущий период)
 * @param {Date} customTo - для 'custom' (текущий период)
 * @returns {{ from: string | null, to: string | null }} - ISO строки для Supabase или null
 */
export function calculatePreviousPeriodRange(period, baseDate = null, customFrom = null, customTo = null) {
  const date = baseDate || new Date()
  
  switch (period) {
    case 'week': {
      // Предыдущая календарная неделя
      const previousWeekStart = subWeeks(startOfWeek(date, { weekStartsOn: 1 }), 1)
      const from = startOfDay(previousWeekStart)
      const to = endOfDay(endOfWeek(previousWeekStart, { weekStartsOn: 1 }))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
      }
    }
    
    case 'month': {
      // Предыдущий календарный месяц
      const previousMonth = subMonths(date, 1)
      const from = startOfDay(startOfMonth(previousMonth))
      const to = endOfDay(endOfMonth(previousMonth))
      return {
        from: from.toISOString(),
        to: to.toISOString(),
      }
    }
    
    case 'custom': {
      if (!customFrom || !customTo) {
        return { from: null, to: null }
      }
      // Вычисляем длину периода
      const diffDays = differenceInDays(customTo, customFrom) + 1
      // Предыдущий период: заканчивается за день до начала текущего
      const previousTo = subDays(startOfDay(customFrom), 1)
      const previousFrom = subDays(previousTo, diffDays - 1)
      return {
        from: startOfDay(previousFrom).toISOString(),
        to: endOfDay(previousTo).toISOString(),
      }
    }
    
    case 'all':
    default:
      return { from: null, to: null }
  }
}

/**
 * Форматирует описание периода для отображения
 * @param {string} period - 'week' | 'month' | 'all' | 'custom'
 * @param {Date} customFrom - для 'custom'
 * @param {Date} customTo - для 'custom'
 * @param {string} className - опциональный класс
 * @returns {string}
 */
export function formatPeriodDescription(period, customFrom = null, customTo = null, className = null) {
  let periodText = ''
  
  switch (period) {
    case 'week':
      periodText = 'за последнюю неделю'
      break
    case 'month':
      periodText = 'за последний месяц'
      break
    case 'all':
      periodText = 'за всё время'
      break
    case 'custom':
      if (customFrom && customTo) {
        periodText = `за период ${format(customFrom, 'dd.MM.yyyy', { locale: ru })} — ${format(customTo, 'dd.MM.yyyy', { locale: ru })}`
      } else {
        periodText = 'за выбранный период'
      }
      break
    default:
      periodText = 'за период'
  }
  
  if (className && className !== '') {
    return `${periodText} · ${className}`
  }
  
  return periodText
}

