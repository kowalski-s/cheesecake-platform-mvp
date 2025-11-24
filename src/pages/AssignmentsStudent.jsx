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
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 10

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
      return { label: 'просрочено', color: 'bg-[#FFE6E6] text-[#D64545]' }
    }
    
    if (!s) return { label: 'не сдано', color: 'bg-[#F7F7F8] text-[#6A6A6A]' }
    
    const hasGrade = s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
    if (hasGrade) {
      return { label: `проверено (оценка: ${s.grade})`, color: 'bg-[#E6F8EA] text-[#2EAD4C]' }
    }
    
    return { label: 'ожидает проверки', color: 'bg-[#FFF4D6] text-[#C78B00]' }
  }

  // Фильтрация заданий по вкладке
  const filteredAssignments = useMemo(() => {
    if (!Array.isArray(assignments)) return []
    let filtered = []
    if (tab === 'all') {
      filtered = assignments
    } else if (tab === 'unfinished') {
      filtered = assignments.filter(a => {
        const s = a?.submission || null
        const hasGrade = s && s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
        return !s || !hasGrade
      })
    } else if (tab === 'reviewed') {
      filtered = assignments.filter(a => {
        const s = a?.submission || null
        const hasGrade = s && s.grade !== null && s.grade !== undefined && String(s.grade).trim() !== ''
        return !!hasGrade
      })
    } else {
      filtered = assignments
    }
    return filtered
  }, [assignments, tab])

  // Пагинация отфильтрованных заданий
  const paginatedAssignments = useMemo(() => {
    const start = currentPage * itemsPerPage
    const end = start + itemsPerPage
    return filteredAssignments.slice(start, end)
  }, [filteredAssignments, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage)

  // Сброс страницы при смене фильтра
  useEffect(() => {
    setCurrentPage(0)
  }, [tab])

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
          <div className="inline-flex gap-2">
            <button
              className={`rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2 ${
                tab === 'all' 
                  ? 'bg-[#FF8A1F] text-white shadow-[0_2px_4px_rgba(255,138,31,0.2)]' 
                  : 'bg-[#F7F7F8] text-[#6A6A6A] hover:bg-[#F0F0F0]'
              }`}
              onClick={() => setTab('all')}
            >
              Все
            </button>
            <button
              className={`rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2 ${
                tab === 'unfinished' 
                  ? 'bg-[#FF8A1F] text-white shadow-[0_2px_4px_rgba(255,138,31,0.2)]' 
                  : 'bg-[#F7F7F8] text-[#6A6A6A] hover:bg-[#F0F0F0]'
              }`}
              onClick={() => setTab('unfinished')}
            >
              Невыполненные
            </button>
            <button
              className={`rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2 ${
                tab === 'reviewed' 
                  ? 'bg-[#FF8A1F] text-white shadow-[0_2px_4px_rgba(255,138,31,0.2)]' 
                  : 'bg-[#F7F7F8] text-[#6A6A6A] hover:bg-[#F0F0F0]'
              }`}
              onClick={() => setTab('reviewed')}
            >
              Проверенные
            </button>
          </div>
        </div>
        <div className="space-y-[18px]">
          {paginatedAssignments.map(a => {
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
                className="rounded-[14px] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.04)] p-[22px] transition-all duration-200 hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]"
              >
                {/* Верхняя строка: название, описание, статус */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{a.title ?? '—'}</h3>
                    {hasDescription && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{a.description}</p>
                    )}
                    {/* Блок с дедлайном */}
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 text-[#A0A0A0]" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Срок: {formattedDueDate}</span>
                    </div>
                  </div>
                  {/* Статусная капсула */}
                  <div className="flex-shrink-0 sm:self-start">
                    <span className={`inline-flex items-center rounded-[10px] px-2.5 py-1 text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                </div>
                
                {/* Блок действий */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-4">
                  {material && (
                    <button 
                      className="rounded-[10px] border border-[#FF8A1F] text-[#FF8A1F] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[#FF8A1F] hover:text-white transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2"
                      onClick={() => downloadMaterial(material)}
                    >
                      Скачать материал
                    </button>
                  )}
                  {!a.submission && (
                    <NavLink 
                      className="rounded-[10px] border border-[#FF8A1F] text-[#FF8A1F] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[#FF8A1F] hover:text-white transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2 text-center"
                      to={`/student/assignments/${a.id}`}
                    >
                      Отправить работу
                    </NavLink>
                  )}
                  {a.submission && (a.submission.grade == null || String(a.submission.grade).trim() === '') && (
                    <NavLink 
                      className="rounded-[10px] border border-[#FF8A1F] text-[#FF8A1F] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[#FF8A1F] hover:text-white transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2 text-center"
                      to={`/student/assignments/${a.id}`}
                    >
                      Редактировать отправку
                    </NavLink>
                  )}
                  {a.submission && a.submission.grade != null && String(a.submission.grade).trim() !== '' && (
                    <NavLink 
                      className="rounded-[10px] border border-[#FF8A1F] text-[#FF8A1F] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[#FF8A1F] hover:text-white transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#FF8A1F] focus:ring-offset-2 text-center"
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
            <div className="rounded-[14px] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.04)] p-8 text-center text-gray-500">
              Пока заданий нет
            </div>
          )}
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <div className="text-sm text-[#6A6A6A]">
              Показано {paginatedAssignments.length} из {filteredAssignments.length} заданий
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-[10px] px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] text-[#6A6A6A] hover:bg-[#F0F0F0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#F7F7F8]"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              >
                Назад
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i
                  } else if (currentPage < 3) {
                    pageNum = i
                  } else if (currentPage > totalPages - 4) {
                    pageNum = totalPages - 5 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`rounded-[10px] w-8 h-8 text-sm font-medium transition-all duration-200 ${
                        currentPage === pageNum
                          ? 'bg-[#FF8A1F] text-white shadow-[0_2px_4px_rgba(255,138,31,0.2)]'
                          : 'bg-[#F7F7F8] text-[#6A6A6A] hover:bg-[#F0F0F0]'
                      }`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum + 1}
                    </button>
                  )
                })}
              </div>
              <button
                className="rounded-[10px] px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] text-[#6A6A6A] hover:bg-[#F0F0F0] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#F7F7F8]"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Редактор теперь вынесен на отдельную страницу */}

      {banner && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${banner.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{banner.msg}</div>
      )}
    </div>
  )
}