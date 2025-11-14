import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import toast from '@/lib/safeToast'
import PageHeader from '../components/ui/PageHeader'
import Section from '../components/ui/Section'
import Loading from '../components/ui/Loading'
import SubscriptionCard from '../components/student/SubscriptionCard'
import NextLessonCard from '../components/student/NextLessonCard'
import ProgressCard from '../components/student/ProgressCard'
import { getStudentAnalytics } from '@/api/studentAnalytics'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { format } from 'date-fns'

// Отдельный компонент графика оценок с одноразовой анимацией
function GradesTimelineChart({ data, domainMax }) {
  const [shouldAnimate, setShouldAnimate] = useState(false)
  useEffect(() => {
    if (!window.__studentAnalyticsAnimatedOnce) {
      setShouldAnimate(true)
      window.__studentAnalyticsAnimatedOnce = true
    }
  }, [])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd.MM')} />
        <YAxis domain={[0, domainMax]} tickCount={6} />
        <Tooltip
          formatter={(value, name, props) => [value, props.payload.title]}
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
          isAnimationActive={shouldAnimate}
          animationDuration={1800}
          animationEasing="ease-in-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function Students() {
  const { session, profile } = useAuth()
  const user = session?.user || null
  const role = profile?.role || null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [student, setStudent] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [nextLesson, setNextLesson] = useState(null)
  // progress хранит { completed, total, pct }
  const [teacherName, setTeacherName] = useState('—')
  const [myId, setMyId] = useState(null)
  const [lessonDuration, setLessonDuration] = useState(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0, pct: 0 })
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState(null)

  // Глобальный перехватчик ошибок: логируем стек, чтобы понять источник
  useEffect(() => {
    const h = (ev) => {
      console.error('STUDENTS_PAGE_RUNTIME_ERROR:', ev?.error ?? ev?.message, ev?.error?.stack)
    }
    window.addEventListener('error', h)
    window.addEventListener('unhandledrejection', h)
    return () => {
      window.removeEventListener('error', h)
      window.removeEventListener('unhandledrejection', h)
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        // 1) Получаем auth.uid
        const { data: authRes, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        const uid = authRes?.user?.id
        if (!uid) throw new Error('auth.uid is empty')

        // 2) Находим myStudentId
        const { data: stu, error: stuErr } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle()
        if (stuErr) throw stuErr
        const myStudentId = stu?.id ?? null
        if (!myStudentId) throw new Error('student record not found for user')
        setMyId(myStudentId)

        // 3) Параллельно подтягиваем подписку, ближайший урок (с end_at), и прогресс
        const nowIso = new Date().toISOString()

        const [
          subRes,
          nextRes,
          doneCnt,
          totalCnt,
        ] = await Promise.all([
          // абонемент по user_id
          supabase.from('subscriptions')
            .select('id,user_id,name,remaining_lessons,active,created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase.from('lessons')
            .select(`
              id, title, start_at, end_at, duration_min, status, teacher_id,
              teacher:teachers!lessons_teacher_id_fkey (id, display_name)
            `)
            .eq('student_id', myStudentId)
            .gte('start_at', nowIso)
            .order('start_at', { ascending: true })
            .limit(1)
            .maybeSingle(),

          // завершённые уроки
          supabase.from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', myStudentId)
            .eq('status', 'done'),

          // всего по прогрессу (прошедшие + запланированные)
          supabase.from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', myStudentId)
            .in('status', ['done','planned']),
        ])

        if (subRes.error) throw subRes.error
        if (nextRes.error) throw nextRes.error

        const sub = subRes.data ?? null
        setSubscription({
          name: sub?.name ?? 'Абонемент',
          lessonsLeft: sub?.remaining_lessons ?? 0,
          active: !!sub?.active,
        })

        const next = nextRes.data ?? null
        // длительность: если есть end_at — считаем по датам, иначе пробуем duration_min
        let durationMin = null
        if (next?.start_at && next?.end_at) {
          durationMin = Math.round((new Date(next.end_at) - new Date(next.start_at)) / 60000)
        } else if (typeof next?.duration_min === 'number') {
          durationMin = next.duration_min
        }
        setLessonDuration(durationMin)
        setNextLesson(next ? { ...next, duration: durationMin } : null)
        setTeacherName(next?.teacher?.display_name ?? '—')

        // прогресс
        const completed = doneCnt?.count ?? 0
        const total = totalCnt?.count ?? 0
        const pct = total ? Math.round((completed/total)*100) : 0
        setProgress({ completed, total, pct })

        // 4) Загружаем аналитику прогресса (не скрываем секцию при ошибке)
        try {
          setAnalyticsLoading(true)
          setAnalyticsError(null)
          const a = await getStudentAnalytics(myStudentId)
          // Синхронизируем метрику «Уроки» с карточкой «Прогресс» (используем те же вычисления: done/planned)
          setAnalytics({
            ...a,
            lessonsTotal: total,
            completedLessons: completed,
            progressPercent: pct,
          })
        } catch (e) {
          console.error('ERR_LOAD_ANALYTICS', e, e?.stack)
          setAnalyticsError(e)
          if (toast && typeof toast.error === 'function') {
            toast.error('Не удалось загрузить аналитику прогресса')
          }
        } finally {
          setAnalyticsLoading(false)
        }

      } catch (e) {
        console.error('ERR_LOAD_STUDENT', e, e?.stack)
        if (toast && typeof toast.error === 'function') {
          toast.error('Не удалось загрузить данные профиля')
        }
        setError(e)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="py-10">
        <PageHeader title="Личный кабинет ученика" />
        <div className="mt-6 flex justify-center">
          <Loading />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Личный кабинет ученика" />
      {/* Редирект, если роль не student (без раннего return, чтобы не нарушать порядок хуков) */}
      {role && role !== 'student' ? <Navigate to="/" replace /> : null}
      {(() => {
        const code = error?.code
        const details = error?.details
        const isNoRows = code === 'PGRST116' || (typeof details === 'string' && details.includes('Results contain 0 rows'))
        const showError = error != null && !isNoRows
        return showError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error?.message ?? String(error)}
          </div>
        ) : null
      })()}

      <Section>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <SubscriptionCard
            lessonsLeft={typeof subscription?.lessonsLeft === 'number' ? subscription.lessonsLeft : 0}
            active={subscription?.active === true}
          />

          <NextLessonCard
            lesson={nextLesson}
            teacherName={teacherName || null}
          />

          <ProgressCard
            done={progress.completed}
            total={progress.total}
            percent={progress.pct}
            emptyText="Прогресс появится после первых уроков"
          />
        </div>
      </Section>

      {/* Аналитика прогресса — всегда видна, даже при загрузке/ошибке/пустых данных */}
      <Section>
        <h2 className="text-lg font-semibold mb-3">Аналитика прогресса</h2>

        {/* Метрики: скелетоны при загрузке */}
        {analyticsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
            <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
            <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
            <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Уроки */}
            <div className="card p-4">
              <div className="text-sm text-gray-500 mb-1">Уроки</div>
              <div className="font-semibold">Пройдено {analytics?.completedLessons ?? 0} из {analytics?.lessonsTotal ?? 0}</div>
              <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden" aria-label="Прогресс по урокам">
                <div className="h-full bg-brand" style={{ width: `${analytics?.progressPercent ?? 0}%` }}></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{analytics?.progressPercent ?? 0}% программы</div>
            </div>

            {/* Домашние задания */}
            <div className="card p-4">
              <div className="text-sm text-gray-500 mb-1">Домашние задания</div>
              <div className="font-semibold">выполнено {analytics?.completedAssignments ?? 0} из {analytics?.totalAssignments ?? 0} ДЗ</div>
            </div>

            {/* Средняя оценка */}
            <div className="card p-4">
              <div className="text-sm text-gray-500 mb-1">Средняя оценка</div>
              <div className="font-semibold">{analytics?.averageGrade != null ? analytics.averageGrade : '—'}</div>
              {Array.isArray(analytics?.gradesTimeline) && analytics.gradesTimeline.some(r => Number(r?.grade) > 10) ? (
                <div className="text-xs text-gray-500 mt-1">из 100</div>
              ) : null}
            </div>

            {/* Последняя активность */}
            <div className="card p-4">
              <div className="text-sm text-gray-500 mb-1">Последняя активность</div>
              <div className="font-semibold">{analytics?.lastActivityAt ? format(new Date(analytics.lastActivityAt), 'dd.MM.yyyy HH:mm') : '—'}</div>
            </div>
          </div>
        )}

        {/* График оценок */}
        <div className="mt-4">
          {analyticsLoading ? (
            <div className="card p-4">
              <div className="h-72 bg-gray-100 animate-pulse rounded"></div>
            </div>
          ) : (Array.isArray(analytics?.gradesTimeline) && analytics.gradesTimeline.length > 0 ? (
            <div className="card p-4">
              <div style={{ width: '100%', height: 280 }}>
                <GradesTimelineChart
                  data={analytics.gradesTimeline}
                  domainMax={(Array.isArray(analytics?.gradesTimeline) && analytics.gradesTimeline.some(r => Number(r?.grade) > 10)) ? 100 : 10}
                />
              </div>
            </div>
          ) : (
            <div className="card p-4">
              <div className="text-sm text-gray-500">Пока нет данных</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Удалено: блок с кнопкой "Все задания" */}
    </div>
  )
}