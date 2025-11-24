import { useEffect, useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import Section from "../components/ui/Section";
import toast from "@/lib/safeToast";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { getStudentAnalyticsByPeriod } from "@/api/studentAnalytics";
import PageHeader from "../components/ui/PageHeader";
import { calculatePeriodRange, calculatePreviousPeriodRange, formatPeriodDescription } from "../utils/periodUtils";
import { formatDateOnlyYYYYMMDD, parseDateOnlyYYYYMMDD } from "../lib/datetime";

// Функция для расчёта процента изменения
function calculateChangePercent(current, previous) {
  if (previous === 0) {
    if (current > 0) return 100
    return 0
  }
  return ((current - previous) / previous) * 100
}

// Компонент индикатора изменения
function ChangeIndicator({ current, previous, periodType = '', label = '' }) {
  if (previous === null || previous === undefined) return null
  
  const percent = calculateChangePercent(current, previous)
  
  if (percent === 0 && current === 0 && previous === 0) {
    return null
  }
  
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
  
  if (previous === 0 && current > 0) {
    text = `↑ рост ${periodText}`
    color = 'text-green-600'
  } else if (percent > 0) {
    text = `↑ +${Math.round(percent)}% ${periodText}`
    color = 'text-green-600'
  } else if (percent < 0) {
    text = `↓ ${Math.round(percent)}% ${periodText}`
    color = 'text-red-600'
  } else {
    text = `• 0% ${periodText}`
    color = 'text-gray-600'
  }
  
  return (
    <div className={`absolute top-2 right-2 text-[11px] opacity-75 ${color} whitespace-nowrap`} title={text}>
      {text}
    </div>
  )
}

export default function StudentAnalyticsPage() {
  const { session, role, user } = useAuth();
  const userId = user?.id || session?.user?.id || null;
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  // Редирект, если роль не student
  if (role && role !== 'student') {
    return <Navigate to="/" replace />;
  }
  
  // Фильтры
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [baseDate, setBaseDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);

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
    return formatPeriodDescription(selectedPeriod, customFrom, customTo);
  }, [selectedPeriod, customFrom, customTo]);

  // Загружаем studentId и имя студента
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!isSupabaseConfigured || !supabase || !userId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, display_name')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setStudentId(data.id);
          setStudentName(data.display_name || '');
        }
      } catch (e) {
        console.error('Failed to load student', e);
        toast.error('Не удалось загрузить данные студента');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Статистика ученика"
        description={studentName ? `${studentName} (ученик) · ${periodDescription}` : "Загрузка..."}
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
                    const parsed = parseDateOnlyYYYYMMDD(e.target.value);
                    setCustomFrom(parsed);
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
                    const parsed = parseDateOnlyYYYYMMDD(e.target.value);
                    setCustomTo(parsed);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Блок аналитики */}
      <StudentAnalyticsSection 
        studentId={studentId} 
        filters={{
          from: periodRange.from,
          to: periodRange.to,
        }}
        previousFilters={{
          from: previousPeriodRange.from,
          to: previousPeriodRange.to,
        }}
        periodDescription={periodDescription}
        periodType={selectedPeriod}
      />
    </div>
  );
}

// Компонент секции аналитики студента
function StudentAnalyticsSection({ studentId, filters = {}, previousFilters = {}, periodDescription = '', periodType = '' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [previousData, setPreviousData] = useState(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  // Загружаем данные за текущий период
  useEffect(() => {
    let mounted = true;
    async function loadAnalytics() {
      try {
        setLoading(true);
        setError(null);
        if (!studentId) {
          setData(null);
          return;
        }
        const a = await getStudentAnalyticsByPeriod(studentId, {
          from: filters.from || null,
          to: filters.to || null,
        });
        if (mounted) setData(a);
      } catch (e) {
        console.error('ERR_LOAD_STUDENT_ANALYTICS', e, e?.stack);
        setError(e);
        toast.error('Не удалось загрузить аналитику');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAnalytics();
    return () => { mounted = false };
  }, [studentId, filters.from, filters.to]);

  // Загружаем данные за предыдущий период
  useEffect(() => {
    let mounted = true;
    async function loadPreviousAnalytics() {
      if (!previousFilters.from || !previousFilters.to || !studentId) {
        setPreviousData(null);
        return;
      }
      try {
        setLoadingPrevious(true);
        const a = await getStudentAnalyticsByPeriod(studentId, {
          from: previousFilters.from || null,
          to: previousFilters.to || null,
        });
        if (mounted) setPreviousData(a);
      } catch (e) {
        console.error('ERR_LOAD_PREVIOUS_ANALYTICS', e);
        if (mounted) setPreviousData(null);
      } finally {
        if (mounted) setLoadingPrevious(false);
      }
    }
    loadPreviousAnalytics();
    return () => { mounted = false };
  }, [studentId, previousFilters.from, previousFilters.to]);

  // Расчёт метрик
  const completedLessons = data?.completedLessons ?? 0;
  const totalLessons = data?.lessonsTotal ?? 0;
  const attendancePercent = totalLessons > 0 
    ? Math.round((completedLessons / totalLessons) * 100) 
    : 0;

  const completedAssignments = data?.completedAssignments ?? 0;
  const totalAssignments = data?.totalAssignments ?? 0;
  const onTimeAssignments = data?.onTimeAssignments ?? 0;

  const avgGrade = data?.averageGrade;
  const lastActivityAt = data?.lastActivityAt;
  const submissionsCount = data?.submissionsCount ?? 0;

  // Данные за предыдущий период
  const previousCompletedLessons = previousData?.completedLessons ?? 0;
  const previousCompletedAssignments = previousData?.completedAssignments ?? 0;
  const previousAvgGrade = previousData?.averageGrade ?? null;
  const previousOnTimeAssignments = previousData?.onTimeAssignments ?? 0;

  // Расчёт изменений для ДЗ
  const assignmentsDiff = previousCompletedAssignments !== null && previousCompletedAssignments !== undefined
    ? completedAssignments - previousCompletedAssignments
    : null;

  // Расчёт изменений для средней оценки
  const gradeDiff = previousAvgGrade !== null && avgGrade !== null
    ? Math.round((avgGrade - previousAvgGrade) * 10) / 10
    : null;

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
                {completedLessons} <span className="text-lg text-gray-500">/ {totalLessons}</span>
              </div>
              {totalLessons > 0 ? (
                <>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden" aria-label="Посещаемость">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300" style={{ width: `${attendancePercent}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Посещаемость: {attendancePercent}%</div>
                </>
              ) : (
                <div className="text-xs text-gray-500 mt-2">за этот период данных нет</div>
              )}
            </div>

            {/* Домашние задания */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col relative">
              {assignmentsDiff !== null && (
                <div className={`absolute top-2 right-2 text-[11px] opacity-75 whitespace-nowrap ${
                  assignmentsDiff > 0 ? 'text-green-600' : assignmentsDiff < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {assignmentsDiff > 0 ? `+${assignmentsDiff}` : assignmentsDiff < 0 ? `${assignmentsDiff}` : '0'} к прошлому периоду
                </div>
              )}
              <div className="text-sm text-gray-500 mb-2">Домашние задания</div>
              <div className="text-2xl font-semibold text-gray-900 mb-3">
                {completedAssignments} <span className="text-lg text-gray-500">/ {totalAssignments}</span>
              </div>
              <div className="text-xs text-gray-500">Своевременно: {onTimeAssignments}</div>
            </div>

            {/* Средняя оценка */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col relative">
              {gradeDiff !== null && (
                <div className={`absolute top-2 right-2 text-[11px] opacity-75 whitespace-nowrap ${
                  gradeDiff > 0 ? 'text-green-600' : gradeDiff < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {gradeDiff > 0 ? `+${gradeDiff}` : gradeDiff < 0 ? `${gradeDiff}` : '0'} к прошлому периоду
                </div>
              )}
              <div className="text-sm text-gray-500 mb-2">Средняя оценка</div>
              <div className="text-2xl font-semibold text-gray-900">
                {avgGrade != null ? avgGrade : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-2">по всем урокам за период</div>
            </div>

            {/* Активность */}
            <div className="card p-5 border border-gray-200 hover:shadow-md transition-shadow flex flex-col">
              <div className="text-sm text-gray-500 mb-2">Активность</div>
              <div className="text-sm font-semibold text-gray-900 mb-1">
                {lastActivityAt ? format(new Date(lastActivityAt), 'dd.MM.yyyy HH:mm') : '—'}
              </div>
              <div className="text-xs text-gray-500">Отправлено ДЗ: {submissionsCount}</div>
            </div>
          </div>

          {/* Графики */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* График посещаемости */}
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Посещаемость</h3>
              {data?.lessonsList && data.lessonsList.length > 0 ? (
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={groupLessonsByDate(data.lessonsList)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd.MM')} stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        formatter={(value) => [value, 'Проведено уроков']}
                        labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy')}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="#f78c1f"
                        radius={[6, 6, 0, 0]}
                        animationDuration={300}
                      >
                        {groupLessonsByDate(data.lessonsList).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            style={{ 
                              cursor: 'pointer',
                              transition: 'opacity 0.2s ease'
                            }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-8 text-center">Нет данных за период</div>
              )}
            </div>

            {/* График оценок */}
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Оценки</h3>
              {data?.gradesTimeline && data.gradesTimeline.length > 0 ? (
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.gradesTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd.MM')} stroke="#6b7280" />
                      <YAxis domain={[0, 'auto']} stroke="#6b7280" />
                      <Tooltip 
                        formatter={(value) => [value, 'Оценка']}
                        labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy')}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="grade" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        dot={{ 
                          r: 5, 
                          fill: '#ef4444',
                          strokeWidth: 2,
                          stroke: '#fff',
                          cursor: 'pointer'
                        }}
                        activeDot={{ 
                          r: 6, 
                          fill: '#ef4444',
                          strokeWidth: 2,
                          stroke: '#fff',
                          style: { filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }
                        }}
                        animationDuration={300}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-8 text-center">Нет данных за период</div>
              )}
            </div>
          </div>

          {/* Таблица уроков */}
          <StudentLessonsTable lessons={data?.lessonsList || []} loading={loading} />

          {/* Таблица домашних заданий */}
          <StudentAssignmentsTable assignments={data?.assignmentsList || []} loading={loading} />
        </>
      )}
    </Section>
  );
}

// Вспомогательная функция для группировки уроков по датам
function groupLessonsByDate(lessons) {
  const grouped = {};
  lessons.forEach(lesson => {
    if (!lesson.date) return;
    const date = format(new Date(lesson.date), 'yyyy-MM-dd');
    if (!grouped[date]) {
      grouped[date] = { date, count: 0 };
    }
    if (lesson.status === 'done') {
      grouped[date].count++;
    }
  });
  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Таблица уроков
function StudentLessonsTable({ lessons, loading }) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Функция для получения числового значения статуса для сортировки
  const getStatusSortValue = (status) => {
    switch (status) {
      case 'planned': return 1;
      case 'done': return 2;
      case 'canceled': return 3;
      default: return 0;
    }
  };

  const sortedLessons = useMemo(() => {
    const sorted = [...lessons];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        comparison = dateA - dateB;
      } else if (sortBy === 'status') {
        comparison = getStatusSortValue(a.status) - getStatusSortValue(b.status);
      } else if (sortBy === 'grade') {
        const gradeA = a.grade ? parseFloat(a.grade) : 0;
        const gradeB = b.grade ? parseFloat(b.grade) : 0;
        comparison = gradeA - gradeB;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [lessons, sortBy, sortOrder]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleRowClick = (lessonId) => {
    if (lessonId) {
      navigate(`/lesson/${lessonId}`);
    }
  };

  const paginatedLessons = sortedLessons.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const totalPages = Math.ceil(sortedLessons.length / itemsPerPage);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'done': return 'Проведён';
      case 'canceled': return 'Отменён';
      case 'planned': return 'Запланирован';
      default: return status || '—';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'text-green-600 bg-green-50';
      case 'canceled': return 'text-gray-600 bg-gray-50';
      case 'planned': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Уроки за период</h3>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Уроки за период</h3>
      {paginatedLessons.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Нет уроков за период</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">
                    <button
                      className="flex items-center gap-1 hover:underline transition-all text-gray-700 hover:text-gray-900"
                      onClick={() => handleSort('date')}
                    >
                      Дата и время
                      <span className={`text-xs text-gray-400 ${sortBy === 'date' ? 'text-gray-600' : ''}`}>
                        {sortBy === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">Предмет / класс</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">Преподаватель</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">
                    <button
                      className="flex items-center gap-1 hover:underline transition-all text-gray-700 hover:text-gray-900"
                      onClick={() => handleSort('status')}
                    >
                      Статус
                      <span className={`text-xs text-gray-400 ${sortBy === 'status' ? 'text-gray-600' : ''}`}>
                        {sortBy === 'status' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">
                    <button
                      className="flex items-center gap-1 hover:underline transition-all text-gray-700 hover:text-gray-900"
                      onClick={() => handleSort('grade')}
                    >
                      Оценка
                      <span className={`text-xs text-gray-400 ${sortBy === 'grade' ? 'text-gray-600' : ''}`}>
                        {sortBy === 'grade' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">Статус ДЗ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLessons.map(lesson => (
                  <tr 
                    key={lesson.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors align-middle"
                    onClick={() => handleRowClick(lesson.id)}
                  >
                    <td className="py-3 pr-4 text-sm text-gray-900 align-middle">
                      {lesson.date ? format(new Date(lesson.date), 'dd.MM.yyyy HH:mm') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">
                      {lesson.title || '—'} {lesson.class_name ? `· ${lesson.class_name}` : ''}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">{lesson.teacher || '—'}</td>
                    <td className="py-3 pr-4 align-middle">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lesson.status)}`}>
                        {getStatusLabel(lesson.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">{lesson.grade || '—'}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">
                      {lesson.assignmentStatus || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Страница {currentPage + 1} из {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                >
                  Назад
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Таблица домашних заданий
function StudentAssignmentsTable({ assignments, loading }) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Функция для получения числового значения статуса для сортировки
  const getStatusSortValue = (status) => {
    switch (status) {
      case 'overdue': return 1;
      case 'not_submitted': return 2;
      case 'completed': return 3;
      default: return 0;
    }
  };

  const sortedAssignments = useMemo(() => {
    const sorted = [...assignments];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'dueDate') {
        const dateA = a.dueDate ? new Date(a.dueDate) : new Date(0);
        const dateB = b.dueDate ? new Date(b.dueDate) : new Date(0);
        comparison = dateA - dateB;
      } else if (sortBy === 'status') {
        comparison = getStatusSortValue(a.status) - getStatusSortValue(b.status);
      } else if (sortBy === 'grade') {
        const gradeA = a.grade ? parseFloat(a.grade) : 0;
        const gradeB = b.grade ? parseFloat(b.grade) : 0;
        comparison = gradeA - gradeB;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [assignments, sortBy, sortOrder]);

  const paginatedAssignments = sortedAssignments.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const totalPages = Math.ceil(sortedAssignments.length / itemsPerPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleRowClick = (assignmentId) => {
    if (assignmentId) {
      navigate(`/student/assignments/${assignmentId}`);
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Выполнено';
      case 'overdue': return 'Просрочено';
      case 'not_submitted': return 'Не сдано';
      default: return status || '—';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      case 'not_submitted': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Домашние задания</h3>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Домашние задания</h3>
      {paginatedAssignments.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Нет заданий за период</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">Название задания</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">Дата урока</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">
                    <button
                      className="flex items-center gap-1 hover:underline transition-all text-gray-700 hover:text-gray-900"
                      onClick={() => handleSort('dueDate')}
                    >
                      Дедлайн
                      <span className={`text-xs text-gray-400 ${sortBy === 'dueDate' ? 'text-gray-600' : ''}`}>
                        {sortBy === 'dueDate' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">
                    <button
                      className="flex items-center gap-1 hover:underline transition-all text-gray-700 hover:text-gray-900"
                      onClick={() => handleSort('status')}
                    >
                      Статус
                      <span className={`text-xs text-gray-400 ${sortBy === 'status' ? 'text-gray-600' : ''}`}>
                        {sortBy === 'status' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700 align-middle">
                    <button
                      className="flex items-center gap-1 hover:underline transition-all text-gray-700 hover:text-gray-900"
                      onClick={() => handleSort('grade')}
                    >
                      Оценка
                      <span className={`text-xs text-gray-400 ${sortBy === 'grade' ? 'text-gray-600' : ''}`}>
                        {sortBy === 'grade' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssignments.map(assign => (
                  <tr 
                    key={assign.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors align-middle"
                    onClick={() => handleRowClick(assign.id)}
                  >
                    <td className="py-3 pr-4 text-sm text-gray-900 align-middle">{assign.title || '—'}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">
                      {assign.lessonDate ? format(new Date(assign.lessonDate), 'dd.MM.yyyy') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">
                      {assign.dueDate ? format(new Date(assign.dueDate), 'dd.MM.yyyy') : '—'}
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assign.status)}`}>
                        {getStatusLabel(assign.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-700 align-middle">{assign.grade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Страница {currentPage + 1} из {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                >
                  Назад
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

