import { useEffect, useState, useRef } from 'react'
import { Navigate, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import toast from '@/lib/safeToast'
import PageHeader from '../components/ui/PageHeader'
import Section from '../components/ui/Section'
import Loading from '../components/ui/Loading'
import SubscriptionCard from '../components/student/SubscriptionCard'
import NextLessonCard from '../components/student/NextLessonCard'
import ProgressCard from '../components/student/ProgressCard'
import Avatar from '../components/ui/Avatar'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { format } from 'date-fns'

// Отдельный компонент графика ученика. Глобальный флаг — без локальных состояний.
function StudentGradesTimelineChart({ data, domainMax }) {
  useEffect(() => {
    if (!window.__studentAnalyticsAnimatedOnce) {
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
          isAnimationActive={false}
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ display_name: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef(null)

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

        // 2) Находим myStudentId и загружаем данные студента
        const { data: stu, error: stuErr } = await supabase
          .from('students')
          .select('id, display_name, avatar_url')
          .eq('user_id', uid)
          .maybeSingle()
        if (stuErr) throw stuErr
        const myStudentId = stu?.id ?? null
        if (!myStudentId) throw new Error('student record not found for user')
        setMyId(myStudentId)
        setStudent(stu) // Сохраняем данные студента, включая avatar_url

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
  }, [user?.id])

  // Инициализация формы профиля при загрузке данных
  useEffect(() => {
    if (student) {
      setProfileForm({
        display_name: student.display_name || ''
      })
    }
  }, [student])

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5MB')
      return
    }

    if (!myId) {
      toast.error('ID студента не найден')
      return
    }

    setUploadingAvatar(true)
    try {
      // Удаляем старое изображение если есть
      if (student?.avatar_url) {
        try {
          await supabase.storage.from('avatars').remove([student.avatar_url])
        } catch (err) {
          console.warn('Не удалось удалить старое изображение', err)
        }
      }

      // Загружаем новое изображение
      const userId = user?.id
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${userId}/${timestamp}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Сохраняем через update по ID записи
      const { error: updateError } = await supabase
        .from('students')
        .update({ avatar_url: filePath })
        .eq('id', myId)

      if (updateError) throw updateError

      toast.success('Аватар обновлён')
      
      // Обновляем локальное состояние
      setStudent(prev => prev ? { ...prev, avatar_url: filePath } : null)
      
      // Перезагружаем страницу для обновления всех данных
      window.location.reload()
    } catch (e) {
      console.error(e)
      toast.error(e?.message || 'Не удалось загрузить аватар')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSaveProfile = async () => {
    if (!myId) {
      toast.error('ID студента не найден')
      return
    }

    setSavingProfile(true)
    try {
      const { error: updateError } = await supabase
        .from('students')
        .update({
          display_name: profileForm.display_name.trim()
        })
        .eq('id', myId)

      if (updateError) throw updateError

      toast.success('Профиль сохранён')
      setEditingProfile(false)
      
      // Обновляем локальное состояние
      setStudent(prev => prev ? { 
        ...prev, 
        display_name: profileForm.display_name.trim()
      } : null)
      
      // Перезагружаем страницу для синхронизации
      window.location.reload()
    } catch (e) {
      console.error(e)
      toast.error(e?.message || 'Не удалось сохранить профиль')
    } finally {
      setSavingProfile(false)
    }
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

      {/* Профиль студента с аватаром */}
      {student && (
        <Section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                  title="Нажмите, чтобы изменить аватар"
                >
                  <Avatar 
                    displayName={student.display_name || ""} 
                    email={user?.email || ""} 
                    size="md" 
                    avatarUrl={student.avatar_url}
                  />
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6 text-white" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </button>
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {student.display_name || 'Студент'}
                  </h1>
                  <div className="mt-1 text-sm text-gray-600">{user?.email || '—'}</div>
                </div>
            </div>
            {!editingProfile && (
              <button
                className="rounded-xl bg-brand py-2.5 px-6 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
                onClick={() => setEditingProfile(true)}
              >
                Редактировать профиль
              </button>
            )}
          </div>

          {/* Форма редактирования профиля */}
          {editingProfile && (
            <div id="student-profile-form" className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Имя</label>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0 transition-colors"
                  type="text"
                  value={profileForm.display_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Введите имя"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  className="rounded-xl bg-brand py-2.5 px-6 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Сохраняем..." : "Сохранить"}
                </button>
                <button
                  className="rounded-xl border border-gray-300 py-2.5 px-6 text-center font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setEditingProfile(false)
                    setProfileForm({
                      display_name: student.display_name || ''
                    })
                  }}
                  disabled={savingProfile}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

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


      {/* Удалено: блок с кнопкой "Все задания" */}
    </div>
  )
}