import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { getMyStudentId } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'
import toast from '@/lib/safeToast'

export default function AssignmentsStudentPage() {
  const { role } = useAuth()
  const isStudent = useMemo(() => (role || '').trim().toLowerCase() === 'student', [role])
  const [assignments, setAssignments] = useState([])
  const [tab, setTab] = useState('all') // all | unfinished | reviewed
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [banner, setBanner] = useState(null)
  const [fileByAssignment, setFileByAssignment] = useState({})
  const [confirmId, setConfirmId] = useState(null)
  const [materialsMap, setMaterialsMap] = useState({})
  const [myId, setMyId] = useState(null)

  // Глобальный перехватчик ошибок с выводом стека
  useEffect(() => {
    const h = (ev) => {
      console.error('RUNTIME_ERR:', ev?.error ?? ev?.message, ev?.error?.stack)
    }
    window.addEventListener('error', h)
    window.addEventListener('unhandledrejection', h)
    return () => {
      window.removeEventListener('error', h)
      window.removeEventListener('unhandledrejection', h)
    }
  }, [])

  // Единая утилита получения myStudentId и последующая загрузка заданий
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const myStudentId = await getMyStudentId(supabase)
        setMyId(myStudentId)
        if (!myStudentId) {
          setAssignments([])
          setSubs([])
          setMaterialsMap({})
          return
        }

        // Nested select с алиасом 'assignment' и сортировкой по foreignTable
        const baseSelect = `
          assignment:assignments (
            id,
            title,
            description,
            due_date,
            created_at,
            lesson_id
          )
        `

        let q = supabase
          .from('assignment_targets')
          .select(baseSelect)
          .eq('student_id', myStudentId)

        q = q
          .order('due_date', { foreignTable: 'assignment', ascending: true })
          .order('created_at', { foreignTable: 'assignment', ascending: false })

        const { data, error } = await q
        if (error) {
          console.error('ERR_LOAD_STUDENT_ASSIGNMENTS', error)
          setAssignments([])
          return
        }

        const normalized = (data ?? [])
          .map(row => row.assignment)
          .filter(Boolean)

        setAssignments(normalized)

        // Подгружаем статусы submissions пакетно
        const assignmentIds = normalized.map(a => a.id)
        if (assignmentIds.length) {
          const { data: subs, error: subsErr } = await supabase
            .from('submissions')
            .select('assignment_id, student_id, file_url, comment, grade, feedback, created_at')
            .in('assignment_id', assignmentIds)
            .eq('student_id', myStudentId)
          if (subsErr) {
            console.error('ERR_LOAD_SUBMISSIONS', subsErr)
          }
          const byAssign = new Map()
          ;(subs ?? []).forEach(s => byAssign.set(s.assignment_id, s))
          const withStatus = normalized.map(a => ({
            ...a,
            submission: byAssign.get(a.id) || null,
          }))
          setAssignments(withStatus)
        }
      } catch (e) {
        console.error('ERR_LOAD_STUDENT_ID', e, e?.stack)
        setAssignments([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  // Безопасное имя файла
const safeName = (name) => (name || '').replace(/[^a-zA-Z0-9._-]/g, '_')
const HOMEWORK_BUCKET = 'submissions'

  // Перезагрузка сабмишнов (как ФУНКЦИЯ, вызывается без скобок при передаче в props)
  const refetchSubmissions = async () => {
    if (!myId) return
    const { data: subsData } = await supabase
      .from('submissions')
      .select('id, assignment_id, grade, feedback, file_url, comment, created_at')
      .eq('student_id', myId)
    setSubs(subsData ?? [])
  }

  useEffect(() => {
    const load = async () => {
      if (!myId) return
      setLoading(true)
      setError(null)
      try {
        // Список назначенных мне заданий через assignment_targets
        const { data: targets, error: tErr } = await supabase
          .from('assignment_targets')
          .select(`
            assignment_id,
            assignments:assignments!assignment_targets_assignment_id_fkey (
              id, title, description, due_date, teacher_id, lesson_id, material_id
            )
          `)
          .eq('student_id', myId)
          .order('assignments(due_date)', { ascending: true })
        if (tErr) throw tErr
        const list = (targets || []).map(t => t.assignments).filter(Boolean)
        setAssignments(list)

        // Загрузим метаданные материалов для прикреплённых ДЗ
        const matIds = list.map(a => a.material_id).filter(Boolean)
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

        // Мои сабмишны по этим заданиям
        const ids = list.map(a => a.id).filter(Boolean)
        let subsArr = []
        if (ids.length > 0) {
          const { data: subsData } = await supabase
            .from('submissions')
            .select('id, assignment_id, file_url, comment, grade, feedback, created_at')
            .eq('student_id', myId)
            .in('assignment_id', ids)
          subsArr = subsData || []
        }
        const byAssign = Object.fromEntries((subsArr || []).map(s => [s.assignment_id, s]))
        setAssignments(list.map(a => ({ ...a, submission: byAssign[a.id] || null })))
      } catch (e) {
        console.error('ERR_LOAD_STUDENT', e, e?.stack)
        setError(e?.message || 'Не удалось загрузить задания')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [myId])

  // Определение статуса на основе встроенного в assignment submission
  const statusFor = (a) => {
    const s = a?.submission || null
    const now = new Date()
    const dueDate = a?.due_date ? new Date(a.due_date) : null
    const isOverdue = dueDate && now > dueDate && !s
    
    if (isOverdue) {
      return { label: 'просрочено', color: 'bg-red-50 text-red-700' }
    }
    
    if (!s) return { label: 'не сдано', color: 'bg-gray-50 text-gray-700' }
    
    const hasGrade = s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
    if (hasGrade) {
      return { label: `проверено (оценка: ${s.grade})`, color: 'bg-green-50 text-green-700' }
    }
    
    return { label: 'ожидает проверки', color: 'bg-orange-50 text-orange-700' }
  }

  // Фильтрация заданий по вкладке
  const filteredAssignments = useMemo(() => {
    if (!Array.isArray(assignments)) return []
    if (tab === 'all') return assignments
    if (tab === 'unfinished') {
      return assignments.filter(a => {
        const s = a?.submission || null
        const hasGrade = s && s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
        return !s || !hasGrade
      })
    }
    if (tab === 'reviewed') {
      return assignments.filter(a => {
        const s = a?.submission || null
        const hasGrade = s && s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
        return !!hasGrade
      })
    }
    return assignments
  }, [assignments, tab])

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

  async function handleSubmit(assignment) {
    try {
      const file = fileByAssignment[assignment.id]
      if (!file) { if (typeof toast.error === 'function') toast.error('Выберите файл'); setBanner({ type: 'error', msg: 'Выберите файл' }); return }

      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      const sid = myId || uid
      const path = `${sid}/${assignment.id}-${Date.now()}-${safeName(file.name)}`
      const up = await supabase.storage.from(HOMEWORK_BUCKET).upload(path, file, { upsert: true })
      if (up.error) throw up.error
      const { data } = supabase.storage.from(HOMEWORK_BUCKET).getPublicUrl(path)
      const fileUrl = data?.publicUrl || null

      const { error: upsertErr } = await submitHomework(supabase, {
        assignmentId: assignment.id,
        studentId: sid,
        fileUrl,
        comment: null,
      })
      if (upsertErr) throw upsertErr

      if (typeof toast.success === 'function') toast.success('Работа отправлена')
      setBanner({ type: 'success', msg: 'Работа отправлена' })
      setConfirmId(null)
      setFileByAssignment(prev => ({ ...prev, [assignment.id]: null }))
      // После отправки — обновляем статус submission для задания
      try {
        const { data: subsData, error: subsErr } = await supabase
          .from('submissions')
          .select('assignment_id, student_id, file_url, comment, grade, feedback, created_at')
          .eq('student_id', myId)
          .eq('assignment_id', assignment.id)
        if (!subsErr) {
          const s = (subsData || [])[0] || null
          setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, submission: s } : a))
        }
      } catch (e2) {
        console.error('ERR_LOAD_SUBMISSIONS', e2)
      }
    } catch (e) {
      console.error('SUBMIT_ERR', e, e?.stack)
      if (typeof toast.error === 'function') toast.error(typeof e?.message === 'string' ? e.message : 'Не удалось отправить ДЗ')
      setBanner({ type: 'error', msg: typeof e?.message === 'string' ? e.message : 'Не удалось отправить ДЗ' })
    } finally {
      setTimeout(() => setBanner(null), 2500)
    }
  }

  if (!isStudent) return <div className="card p-6 text-center">Доступ запрещён</div>
  if (loading) return <Loading message="Загрузка заданий..." />
  if (myId === null) return <div className="card p-6 text-center">Нет профиля студента</div>

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Домашние задания</h2>
          <div className="inline-flex rounded-full p-1 bg-orange-50/50 border border-orange-100/50 shadow-sm">
            <button
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-orange-50/50 ${
                tab === 'all' 
                  ? 'bg-brand text-white shadow-sm' 
                  : 'bg-transparent text-gray-700 hover:bg-orange-100/30'
              }`}
              onClick={() => setTab('all')}
            >
              Все
            </button>
            <button
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-orange-50/50 ${
                tab === 'unfinished' 
                  ? 'bg-brand text-white shadow-sm' 
                  : 'bg-transparent text-gray-700 hover:bg-orange-100/30'
              }`}
              onClick={() => setTab('unfinished')}
            >
              Невыполненные
            </button>
            <button
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-orange-50/50 ${
                tab === 'reviewed' 
                  ? 'bg-brand text-white shadow-sm' 
                  : 'bg-transparent text-gray-700 hover:bg-orange-100/30'
              }`}
              onClick={() => setTab('reviewed')}
            >
              Проверенные
            </button>
          </div>
        </div>
        <div className="space-y-3 sm:space-y-4">
          {filteredAssignments.map(a => {
            const st = statusFor(a)
            const material = a?.material_id ? materialsMap[a.material_id] : null
            const hasDescription = (a.description ?? '').trim()
            const dueDate = a.due_date ? new Date(a.due_date) : null
            const formattedDueDate = dueDate 
              ? `${dueDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${dueDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
              : 'без срока'
            
            return (
              <div 
                key={a.id} 
                className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 sm:p-5 transition-all duration-150 hover:shadow-md hover:bg-orange-50/20"
              >
                {/* Верхняя строка: название, описание, статус */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1.5">{a.title ?? '—'}</h3>
                    {hasDescription && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{a.description}</p>
                    )}
                    {/* Блок с дедлайном */}
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 group">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="group-hover:text-gray-800 transition-colors">Срок: {formattedDueDate}</span>
                    </div>
                  </div>
                  {/* Статусная капсула */}
                  <div className="flex-shrink-0 sm:self-start">
                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                </div>
                
                {/* Блок действий */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-2 border-t border-gray-100">
                  {material && (
                    <button 
                      className="rounded-full border border-brand text-brand bg-white px-4 py-2 text-sm font-medium hover:bg-orange-50 transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                      onClick={() => downloadMaterial(material)}
                    >
                      Скачать материал
                    </button>
                  )}
                  {!a.submission && (
                    <NavLink 
                      className="rounded-full bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-muted hover:shadow-md transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 text-center"
                      to={`/student/assignments/${a.id}`}
                    >
                      Отправить работу
                    </NavLink>
                  )}
                  {a.submission && (a.submission.grade == null || String(a.submission.grade).trim() === '') && (
                    <NavLink 
                      className="rounded-full bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-muted hover:shadow-md transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 text-center"
                      to={`/student/assignments/${a.id}`}
                    >
                      Редактировать отправку
                    </NavLink>
                  )}
                  {a.submission && a.submission.grade != null && String(a.submission.grade).trim() !== '' && (
                    <NavLink 
                      className="rounded-full bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-muted hover:shadow-md transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 text-center"
                      to={`/student/assignments/${a.id}`}
                    >
                      Посмотреть комментарий преподавателя
                    </NavLink>
                  )}
                </div>
              </div>
            )
          })}
          {filteredAssignments.length === 0 && (
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-8 text-center text-gray-500">
              Пока заданий нет
            </div>
          )}
        </div>
      </section>

      {/* Редактор теперь вынесен на отдельную страницу */}

      {banner && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${banner.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{banner.msg}</div>
      )}
    </div>
  )
}