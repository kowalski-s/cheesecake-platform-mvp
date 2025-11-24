import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import Section from "../components/ui/Section";
import toast from "@/lib/safeToast";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getTeacherAnalytics, getTeacherStudentsStats, getTeacherClassNames } from "@/api/teacherAnalytics";
import PageHeader from "../components/ui/PageHeader";
import { calculatePeriodRange, calculatePreviousPeriodRange, formatPeriodDescription } from "../utils/periodUtils";
import { formatDateOnlyYYYYMMDD, parseDateOnlyYYYYMMDD } from "../lib/datetime";

export default function TeacherAnalyticsPage() {
  const { session, role, user } = useAuth();
  const userId = user?.id || session?.user?.id || null;
  const [teacherId, setTeacherId] = useState(null);
  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Фильтры
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // 'week' | 'month' | 'all' | 'custom'
  const [baseDate, setBaseDate] = useState(new Date()); // Базовая дата для расчёта периода
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [selectedClassName, setSelectedClassName] = useState(''); // '' = все уровни
  const [availableClasses, setAvailableClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Вычисляем диапазон дат для фильтра (текущий период)
  const periodRange = useMemo(() => {
    return calculatePeriodRange(selectedPeriod, baseDate, customFrom, customTo);
  }, [selectedPeriod, baseDate, customFrom, customTo]);

  // Вычисляем диапазон дат для предыдущего периода
  const previousPeriodRange = useMemo(() => {
    if (selectedPeriod === 'all') return { from: null, to: null };
    return calculatePreviousPeriodRange(selectedPeriod, baseDate, customFrom, customTo);
  }, [selectedPeriod, baseDate, customFrom, customTo]);

  // Форматируем описание периода
  const periodDescription = useMemo(() => {
    return formatPeriodDescription(selectedPeriod, customFrom, customTo, selectedClassName || null);
  }, [selectedPeriod, customFrom, customTo, selectedClassName]);

  // Загружаем teacherId и имя преподавателя
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!isSupabaseConfigured || !supabase || !userId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error: fetchError } = await supabase
          .from("teachers")
          .select("id, display_name")
          .eq("user_id", userId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        setTeacherId(data?.id || null);
        setTeacherName(data?.display_name || "");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  // Загружаем список классов
  useEffect(() => {
    const loadClasses = async () => {
      if (!teacherId) return;
      setLoadingClasses(true);
      try {
        const classes = await getTeacherClassNames(teacherId);
        setAvailableClasses(classes);
      } catch (e) {
        console.error('Failed to load classes', e);
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, [teacherId]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Аналитика преподавателя"
        description={teacherName ? `${teacherName} · ${periodDescription}` : "Загрузка..."}
      />

      {/* Фильтры */}
      <div className="card p-4 space-y-4">
        {/* Переключатель периода */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Период</label>
          <div className="flex flex-wrap gap-2">
            {['week', 'month', 'all', 'custom'].map(period => (
              <button
                key={period}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-brand text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : period === 'all' ? 'Всё время' : 'Свой период'}
              </button>
            ))}
          </div>
          
          {/* Кастомный диапазон дат */}
          {selectedPeriod === 'custom' && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Дата от</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  value={customFrom ? formatDateOnlyYYYYMMDD(customFrom) : ''}
                  onChange={(e) => {
                    const d = parseDateOnlyYYYYMMDD(e.target.value);
                    if (d) setCustomFrom(d);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Дата до</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  value={customTo ? formatDateOnlyYYYYMMDD(customTo) : ''}
                  onChange={(e) => {
                    const d = parseDateOnlyYYYYMMDD(e.target.value);
                    if (d) setCustomTo(d);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Фильтр по классу */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Класс / уровень</label>
          <select
            className="w-full sm:w-auto min-w-[200px] border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            value={selectedClassName}
            onChange={(e) => setSelectedClassName(e.target.value)}
            disabled={loadingClasses}
          >
            <option value="">Все уровни</option>
            {availableClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Блок аналитики */}
      <TeacherAnalyticsSection 
        teacherId={teacherId} 
        filters={{
          from: periodRange.from,
          to: periodRange.to,
          className: selectedClassName || null,
        }}
        previousFilters={{
          from: previousPeriodRange.from,
          to: previousPeriodRange.to,
          className: selectedClassName || null,
        }}
        periodDescription={periodDescription}
        periodType={selectedPeriod}
      />
    </div>
  );
}

// График оценок преподавателя с одноразовой анимацией на сессию
function TeacherGradesTimelineChart({ data, domainMax }) {
  useEffect(() => {
    if (!window.__teacherAnalyticsAnimatedOnce) {
      window.__teacherAnalyticsAnimatedOnce = true;
    }
  }, []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd.MM')} />
        <YAxis domain={[0, domainMax]} tickCount={6} />
        <Tooltip
          formatter={(value, name, props) => [value, `${props?.payload?.title || '—'} — ${props?.payload?.student || '—'}`]}
          labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy HH:mm')}
        />
        <Line
          type="monotone"
          dataKey="grade"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={false}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          isAnimationActive={!window.__teacherAnalyticsAnimatedOnce}
          animationDuration={1800}
          animationEasing="ease-in-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Функция экспорта в CSV
function exportToCSV(items, periodDescription) {
  if (!items || items.length === 0) {
    toast?.error?.('Нет данных для экспорта')
    return
  }

  const headers = ['Имя ученика', 'Кол-во уроков', 'Выполненные ДЗ', 'Средняя оценка', 'Последняя активность']
  const rows = items.map(row => [
    row.studentName || 'Без имени',
    row.lessonsWithTeacher ?? 0,
    row.submittedAssignments ?? 0,
    row.avgGrade != null ? row.avgGrade : '—',
    row.lastActivityAt ? format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm') : '—',
  ])

  // Формируем CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Экранируем запятые и кавычки
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(','))
  ].join('\n')

  // Создаем BOM для корректного отображения кириллицы в Excel
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  
  // Имя файла с периодом
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const periodStr = periodDescription.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
  link.download = `teacher-analytics-${dateStr}${periodStr ? '-' + periodStr : ''}.csv`
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Таблица "Ученики и прогресс" с пагинацией
function TeacherStudentsStatsSection({ teacherId, filters = {}, periodDescription = '' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let mounted = true
    async function loadStats() {
      try {
        setLoading(true)
        setError(null)
        if (!teacherId) {
          setItems([])
          setTotal(0)
          return
        }
        const res = await getTeacherStudentsStats(teacherId, { 
          limit, 
          offset,
          from: filters.from || null,
          to: filters.to || null,
          className: filters.className || null,
        })
        if (!mounted) return
        setItems(Array.isArray(res?.items) ? res.items : [])
        setTotal(Number(res?.total) || 0)
      } catch (e) {
        console.error('ERR_LOAD_TEACHER_STUDENTS_STATS', e, e?.stack)
        setError(e)
        if (toast && typeof toast.error === 'function') {
          toast.error('Не удалось загрузить статистику по ученикам')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadStats()
    return () => { mounted = false }
  }, [teacherId, limit, offset, filters.from, filters.to, filters.className])

  const canPrev = offset > 0
  const canNext = offset + limit < total

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Ученики и прогресс</h3>
        <button
          className="rounded-xl border border-gray-300 py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => exportToCSV(items, periodDescription)}
          disabled={!items || items.length === 0}
          title={items && items.length > 0 ? 'Экспорт в CSV' : 'Нет данных для экспорта'}
        >
          Экспорт в CSV
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded"></div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-gray-500 py-4">Пока нет данных</div>
      ) : total === 0 ? (
        <div className="py-6 text-center">
          <div className="font-medium text-gray-900 mb-1">Пока нет учеников</div>
          <div className="text-sm text-gray-500">Как только появятся ученики, вы увидите их прогресс здесь</div>
        </div>
      ) : (
        <>
          {/* Таблица для десктопа */}
          <div className="hidden md:block overflow-x-auto -mx-6 px-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Имя ученика</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Кол-во уроков</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Выполненные ДЗ</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Средняя оценка</th>
                  <th className="text-left py-3 font-semibold text-gray-700">Последняя активность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row, idx) => (
                  <tr 
                    key={row.studentId} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900">{row.studentName || 'Без имени'}</td>
                    <td className="py-3 pr-4 text-gray-700">{row.lessonsWithTeacher ?? 0}</td>
                    <td className="py-3 pr-4 text-gray-700">{row.submittedAssignments ?? 0}</td>
                    <td className="py-3 pr-4 text-gray-700">{row.avgGrade != null ? row.avgGrade : '—'}</td>
                    <td className="py-3 text-gray-600">{row.lastActivityAt ? format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Список для мобильных */}
          <div className="md:hidden divide-y divide-gray-200">
            {items.map(row => (
              <div key={row.studentId} className="py-4">
                <div className="font-medium text-gray-900 mb-2">{row.studentName || 'Без имени'}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Уроки:</span>
                    <span className="ml-1 text-gray-900 font-medium">{row.lessonsWithTeacher ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ДЗ:</span>
                    <span className="ml-1 text-gray-900 font-medium">{row.submittedAssignments ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Оценка:</span>
                    <span className="ml-1 text-gray-900 font-medium">{row.avgGrade != null ? row.avgGrade : '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Активность:</span>
                    <span className="ml-1 text-gray-900">{row.lastActivityAt ? format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm') : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Пагинация */}
          {total > limit && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Показано {Math.min(total, offset + 1)}–{Math.min(total, offset + limit)} из {total}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-gray-300 py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canPrev}
                  onClick={() => setOffset(prev => Math.max(0, prev - limit))}
                >
                  Назад
                </button>
                <button
                  className="rounded-xl border border-gray-300 py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canNext}
                  onClick={() => setOffset(prev => prev + limit)}
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Функция для расчёта процента изменения
function calculateChangePercent(current, previous) {
  if (previous === 0) {
    if (current > 0) return 100 // Рост относительно нуля
    return 0 // Оба нуля
  }
  return ((current - previous) / previous) * 100
}

// Компонент индикатора изменения
function ChangeIndicator({ current, previous, periodType = '' }) {
  if (previous === null || previous === undefined) return null
  
  const percent = calculateChangePercent(current, previous)
  
  if (percent === 0 && current === 0 && previous === 0) {
    return null // Оба нуля - не показываем
  }
  
  // Определяем текст периода для отображения
  let periodText = ''
  if (periodType === 'week') {
    periodText = 'к прошлой неделе'
  } else if (periodType === 'month') {
    periodText = 'к прошлому месяцу'
  } else if (periodType === 'custom') {
    periodText = 'к прошлому периоду'
  } else {
    periodText = 'к прошлому периоду'
  }
  
  let text = ''
  let color = 'text-gray-600'
  let symbol = '•'
  
  if (previous === 0 && current > 0) {
    text = `↑ рост ${periodText}`
    color = 'text-green-600'
    symbol = '↑'
  } else if (percent > 0) {
    text = `↑ +${Math.round(percent)}% ${periodText}`
    color = 'text-green-600'
    symbol = '↑'
  } else if (percent < 0) {
    text = `↓ ${Math.round(percent)}% ${periodText}`
    color = 'text-red-600'
    symbol = '↓'
  } else {
    text = `• 0% ${periodText}`
    color = 'text-gray-600'
    symbol = '•'
  }
  
  return (
    <div className={`absolute top-2 right-2 text-[11px] opacity-75 ${color} whitespace-nowrap`} title={text}>
      {text}
    </div>
  )
}

function TeacherAnalyticsSection({ teacherId, filters = {}, previousFilters = {}, periodDescription = '', periodType = '' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [previousData, setPreviousData] = useState(null)
  const [loadingPrevious, setLoadingPrevious] = useState(false)

  // Загружаем данные за текущий период
  useEffect(() => {
    let mounted = true
    async function loadAnalytics() {
      try {
        setLoading(true)
        setError(null)
        if (!teacherId) {
          setData(null)
          return
        }
        const a = await getTeacherAnalytics(teacherId, {
          from: filters.from || null,
          to: filters.to || null,
          className: filters.className || null,
        })
        if (mounted) setData(a)
      } catch (e) {
        console.error('ERR_LOAD_TEACHER_ANALYTICS', e, e?.stack)
        setError(e)
        if (toast && typeof toast.error === 'function') {
          toast.error('Не удалось загрузить аналитику')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadAnalytics()
    return () => { mounted = false }
  }, [teacherId, filters.from, filters.to, filters.className])

  // Загружаем данные за предыдущий период (если не "всё время")
  useEffect(() => {
    let mounted = true
    async function loadPreviousAnalytics() {
      if (!previousFilters.from || !previousFilters.to || !teacherId) {
        setPreviousData(null)
        return
      }
      try {
        setLoadingPrevious(true)
        const a = await getTeacherAnalytics(teacherId, {
          from: previousFilters.from || null,
          to: previousFilters.to || null,
          className: previousFilters.className || null,
        })
        if (mounted) setPreviousData(a)
      } catch (e) {
        console.error('ERR_LOAD_PREVIOUS_ANALYTICS', e)
        // Не показываем ошибку пользователю, просто не загружаем сравнение
        if (mounted) setPreviousData(null)
      } finally {
        if (mounted) setLoadingPrevious(false)
      }
    }
    loadPreviousAnalytics()
    return () => { mounted = false }
  }, [teacherId, previousFilters.from, previousFilters.to, previousFilters.className])

  const totalLessons = data?.totalLessons ?? 0
  
  // Статусы уроков
  const doneCount = data?.completedLessons ?? 0
  const plannedCount = data?.plannedLessons ?? 0
  const canceledCount = data?.canceledLessons ?? 0
  
  // Расчёт процента выполнения расписания
  // totalCount = все уроки за период (done + planned + canceled)
  // scheduleCompletion = доля проведённых (done) от всех назначенных
  const totalCount = doneCount + plannedCount + canceledCount
  const scheduleCompletion = totalCount > 0
    ? Math.round((doneCount / totalCount) * 100)
    : 0
  
  const totalAssignmentsGiven = data?.totalAssignmentsGiven ?? 0
  const checkedAssignments = data?.checkedAssignments ?? 0
  const avgGrade = data?.averageGrade
  const lastActivityAt = data?.lastActivityAt
  
  // Данные за предыдущий период для сравнения
  const previousCompletedLessons = previousData?.completedLessons ?? 0
  const completedLessons = doneCount // Для совместимости с индикаторами
  const previousPlannedLessons = previousData?.plannedLessons ?? 0
  const previousCanceledLessons = previousData?.canceledLessons ?? 0
  const previousCheckedAssignments = previousData?.checkedAssignments ?? 0
  const previousAvgGrade = previousData?.averageGrade ?? null

  return (
    <Section>
      {/* Верхняя зона — карточки-метрики */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Уроки */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col relative">
              <ChangeIndicator 
                current={completedLessons} 
                previous={previousCompletedLessons}
                periodType={periodType}
              />
              <div className="text-sm text-gray-500 mb-2">Уроки</div>
              <div className="text-2xl font-semibold text-gray-900 mb-3">
                {doneCount} <span className="text-lg text-gray-500">/ {totalCount}</span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden" aria-label="Прогресс расписания">
                {totalCount > 0 && (
                  <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300" style={{ width: `${scheduleCompletion}%` }}></div>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {totalCount > 0 ? `${scheduleCompletion}% расписания` : '—'}
              </div>
            </div>

            {/* Домашние задания */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col relative">
              <ChangeIndicator 
                current={checkedAssignments} 
                previous={previousCheckedAssignments}
                periodType={periodType}
              />
              <div className="text-sm text-gray-500 mb-2">Домашние задания</div>
              <div className="text-2xl font-semibold text-gray-900 mb-3">
                {checkedAssignments} <span className="text-lg text-gray-500">/ {totalAssignmentsGiven}</span>
              </div>
              <div className="text-xs text-gray-500">Проверенные ДЗ</div>
            </div>

            {/* Средняя оценка */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col relative">
              {previousAvgGrade !== null && avgGrade !== null && (
                <ChangeIndicator 
                  current={avgGrade} 
                  previous={previousAvgGrade}
                  periodType={periodType}
                />
              )}
              <div className="text-sm text-gray-500 mb-2">Средняя оценка</div>
              <div className="text-2xl font-semibold text-gray-900">
                {avgGrade != null ? avgGrade : '—'}
              </div>
              {(Array.isArray(data?.gradesTimeline) && data.gradesTimeline.some(r => Number(r?.grade) > 10)) ? (
                <div className="text-xs text-gray-500 mt-2">из 100</div>
              ) : null}
            </div>

            {/* Последняя активность */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col">
              <div className="text-sm text-gray-500 mb-2">Последняя активность</div>
              <div className="text-sm font-semibold text-gray-900">
                {lastActivityAt ? format(new Date(lastActivityAt), 'dd.MM.yyyy HH:mm') : '—'}
              </div>
            </div>
          </div>

          {/* Статусы уроков (мини-сводка) */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
              <span className="h-2 w-2 rounded-full bg-orange-400"></span>
              <span className="text-sm text-gray-700">Проведено: <span className="font-semibold">{doneCount}</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
              <span className="h-2 w-2 rounded-full bg-blue-400"></span>
              <span className="text-sm text-gray-700">Запланировано: <span className="font-semibold">{plannedCount}</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
              <span className="h-2 w-2 rounded-full bg-gray-400"></span>
              <span className="text-sm text-gray-700">Отменено: <span className="font-semibold">{canceledCount}</span></span>
            </div>
          </div>
        </>
      )}

      {/* График оценок */}
      {!loading && Array.isArray(data?.gradesTimeline) && data.gradesTimeline.length > 0 && (
        <div className="mb-6">
          <div className="card p-5 border border-gray-200">
            <div style={{ width: '100%', height: 280 }}>
              <TeacherGradesTimelineChart
                data={data.gradesTimeline}
                domainMax={(Array.isArray(data?.gradesTimeline) && data.gradesTimeline.some(r => Number(r?.grade) > 10)) ? 100 : 10}
              />
            </div>
          </div>
        </div>
      )}

      {/* Нижняя зона — "Ученики и прогресс" */}
      <div className="pt-6 border-t border-gray-200">
        <TeacherStudentsStatsSection 
          teacherId={teacherId} 
          filters={filters}
          periodDescription={periodDescription}
        />
      </div>
    </Section>
  )
}

