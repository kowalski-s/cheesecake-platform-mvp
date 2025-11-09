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
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [teacher, setTeacher] = useState(null)
  const [myAssignments, setMyAssignments] = useState([])
  const [subsMap, setSubsMap] = useState({})
  const [materialsMap, setMaterialsMap] = useState({})

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

        const [studentRes, subsRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, display_name, teacher_id, remaining_lessons, user_id')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('subscriptions')
            .select('id, name, remaining_lessons, active, created_at')
            .eq('user_id', user.id)
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1),
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
        // Next lesson: fetch separately using student.id if exists
        let nextLessonData = null
        if (studentData?.id) {
          const { data: nextL } = await supabase
            .from('lessons')
            .select('id, title, class_name, start_at, status, teacher_id, duration')
            .eq('student_id', studentData.id)
            .in('status', ['planned','rescheduled'])
            .gte('start_at', nowIso)
            .order('start_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          nextLessonData = nextL || null
        }

        // Прогресс: view student_progress
        if (studentData?.id) {
          const { data: sp } = await supabase
            .from('student_progress')
            .select('done,total')
            .eq('student_id', studentData.id)
            .maybeSingle()
          setProgress({ done: Number(sp?.done || 0), total: Number(sp?.total || 0) })
        } else {
          setProgress({ done: 0, total: 0 })
        }

        // Устанавливаем глобальную ошибку только если она не про "0 rows"
        const possibleErrors = [studentRes.error, subsRes.error].filter(Boolean)
        const significantError = possibleErrors.find((e) => !isNoRowsError(e)) || null
        if (significantError) {
          setError(significantError)
        }

        setStudent(studentData)
        setSubscription(subscriptionData)
        setNextLesson(nextLessonData)

        // Если есть teacher_id — подтягиваем имя преподавателя
        const teacherId = nextLessonData?.teacher_id || studentData?.teacher_id || null
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

        // Мои задания (топ-3 ближайших)
        if (studentData?.id) {
          const { data: targets } = await supabase
            .from('assignment_targets')
            .select('assignment_id, assignments(id, title, description, due_date, material_id, teacher_id)')
            .eq('student_id', studentData.id)
            .order('assignments(due_date)', { ascending: true })
          const all = (targets || []).map(t => t.assignments).filter(Boolean)
          const upcoming = all
            .slice()
            .sort((a, b) => new Date(a?.due_date || 0).getTime() - new Date(b?.due_date || 0).getTime())
            .slice(0, 3)
          setMyAssignments(upcoming)

          // Загрузим метаданные материалов для прикреплённых ДЗ
          const matIds = upcoming.map(a => a.material_id).filter(Boolean)
          if (matIds.length > 0) {
            const { data: mats } = await supabase
              .from('materials')
              .select('id, title, storage_path, file_path, file_type')
              .in('id', matIds)
            const mm = {}
            ;(mats || []).forEach(m => { mm[m.id] = m })
            setMaterialsMap(mm)
          } else {
            setMaterialsMap({})
          }
          const ids = upcoming.map(a => a.id).filter(Boolean)
          if (ids.length > 0) {
            const { data: subs } = await supabase
              .from('submissions')
              .select('id, assignment_id, grade, feedback, file_path')
              .eq('student_id', studentData.id)
              .in('assignment_id', ids)
            const m = {}
            (subs || []).forEach(s => { m[s.assignment_id] = s })
            setSubsMap(m)
          } else {
            setSubsMap({})
          }
        } else {
          setMyAssignments([])
          setSubsMap({})
          setMaterialsMap({})
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

          <ProgressCard
            done={progress.done}
            total={progress.total}
            percent={Math.round((progress.done * 100) / Math.max(1, progress.total))}
            emptyText="Прогресс появится после первых уроков"
          />
        </div>
      </Section>

      <Section title="Мои задания">
        {myAssignments.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600">Вам пока не назначали ДЗ</div>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
              {myAssignments.map(a => {
                const s = subsMap[a.id]
                const status = !s ? { label: 'не сдано', color: 'bg-gray-50 text-gray-700' } : ((s.grade || '').trim() ? { label: `проверено (${s.grade})`, color: 'bg-green-50 text-green-700' } : { label: 'ожидает проверки', color: 'bg-yellow-50 text-yellow-700' })
                const material = a.material_id ? materialsMap[a.material_id] : null
                const downloadMaterial = (m) => {
                  try {
                    const path = m?.file_path || m?.storage_path
                    if (!path) return
                    const { data } = supabase.storage.from('materials').getPublicUrl(path)
                    const url = data?.publicUrl
                    if (!url) return
                    const aTag = document.createElement('a')
                    aTag.href = url
                    aTag.download = (m?.title || (path.split('/').pop()) || 'material')
                    document.body.appendChild(aTag)
                    aTag.click()
                    document.body.removeChild(aTag)
                  } catch (e) {
                    console.error('download material failed', e)
                  }
                }
                return (
                  <li key={a.id} className="flex items-center justify-between py-3 px-4">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-sm text-gray-500">Дедлайн: {a.due_date ? new Date(a.due_date).toLocaleString() : '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {material && (
                        <button className="btn-outline" onClick={() => downloadMaterial(material)}>Скачать материал</button>
                      )}
                      <span className={`rounded-xl px-3 py-1 text-sm ${status.color}`}>{status.label}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex justify-end">
              <a href="/assignments/student" className="btn-outline">Все задания</a>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}