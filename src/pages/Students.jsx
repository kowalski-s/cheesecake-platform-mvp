import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/ui/PageHeader'
import Section from '../components/ui/Section'
import Loading from '../components/ui/Loading'
import SubscriptionCard from '../components/student/SubscriptionCard'
import NextLessonCard from '../components/student/NextLessonCard'
import ProgressCard from '../components/student/ProgressCard'

export default function Students() {
  const { session, profile } = useAuth()
  const user = session?.user || null
  const role = profile?.role || null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [student, setStudent] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [nextLesson, setNextLesson] = useState(null)
  const [teacher, setTeacher] = useState(null)

  // Редирект, если роль не student
  if (role && role !== 'student') {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!supabase || !user?.id) {
          setError({ message: 'Нет подключения к базе или пользователь не найден' })
          setLoading(false)
          return
        }

        // Параллельно тянем информацию об ученике, подписке и ближайшем уроке
        const nowIso = new Date().toISOString()

        const [studentRes, subsRes, lessonsRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, display_name, teacher_id, remaining_lessons')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('subscriptions')
            .select('id, name, remaining_lessons, active, created_at')
            .eq('user_id', user.id)
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('lessons')
            .select('id, title, class_name, start_at, status, teacher_id, duration')
            .eq('student_id', user.id)
            .gte('start_at', nowIso)
            .order('start_at', { ascending: true })
            .limit(1)
            .maybeSingle()
        ])

        // Помощник: игнорируем "пустые" ошибки (нет строк)
        const isNoRowsError = (err) => {
          if (!err) return false
          const code = err.code
          const details = err.details
          return code === 'PGRST116' || (typeof details === 'string' && details.includes('Results contain 0 rows'))
        }

        const studentData = studentRes.data || null
        const subscriptionData = Array.isArray(subsRes.data) && subsRes.data.length > 0 ? subsRes.data[0] : null
        const nextLessonData = lessonsRes.data || null

        // Устанавливаем глобальную ошибку только если она не про "0 rows"
        const possibleErrors = [studentRes.error, subsRes.error, lessonsRes.error].filter(Boolean)
        const significantError = possibleErrors.find((e) => !isNoRowsError(e)) || null
        if (significantError) {
          setError(significantError)
        }

        setStudent(studentData)
        setSubscription(subscriptionData)
        setNextLesson(nextLessonData)

        // Если есть teacher_id — подтягиваем имя преподавателя
        const teacherId = studentData?.teacher_id || nextLessonData?.teacher_id || null
        if (teacherId) {
          const { data: teacherData } = await supabase
            .from('teachers')
            .select('id, display_name')
            .eq('id', teacherId)
            .maybeSingle()
          setTeacher(teacherData || null)
        } else {
          setTeacher(null)
        }
      } catch (e) {
        console.error('Ошибка загрузки данных ученика:', e)
        setError(e)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

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
            subscriptionEnd={null /* нет явного поля окончания в схеме */}
            lessonsLeft={subscription?.remaining_lessons ?? student?.remaining_lessons ?? null}
          />

          <NextLessonCard
            lesson={nextLesson}
            teacherName={teacher?.display_name || null}
          />

          <ProgressCard />
        </div>
      </Section>
    </div>
  )
}