import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'
import toast from '@/lib/safeToast'

export default function AssignmentsStudentPage() {
  const { role } = useAuth()
  const isStudent = useMemo(() => (role || '').trim().toLowerCase() === 'student', [role])
  const [assignments, setAssignments] = useState([])
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

  // Прямая загрузка myId (student.id по user_id)
  async function loadStudentId() {
    try {
      const { data: userRes, error: e1 } = await supabase.auth.getUser()
      if (e1) throw e1
      const uid = userRes?.user?.id
      if (!uid) throw new Error('Не найден auth.uid')

      const { data: s, error: e2 } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle()
      if (e2) throw e2

      setMyId(s?.id ?? null)
    } catch (e) {
      console.error('ERR_LOAD_STUDENT', e, e?.stack)
      if (toast?.error && typeof toast.error === 'function') {
        toast.error('Не удалось загрузить профиль ученика')
      }
    }
  }

  useEffect(() => { loadStudentId() }, [])
  useEffect(() => { console.log('myId', myId) }, [myId])

  // Безопасное имя файла
  const safeName = (name) => (name || '').replace(/[^a-zA-Z0-9._-]/g, '_')

  // Перезагрузка сабмишнов (как ФУНКЦИЯ, вызывается без скобок при передаче в props)
  const refetchSubmissions = async () => {
    if (!myId) return
    const { data: subsData } = await supabase
      .from('submissions')
      .select('id, assignment_id, grade, feedback, file_path')
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
            .select('id, assignment_id, grade, feedback, file_path')
            .eq('student_id', myId)
            .in('assignment_id', ids)
          subsArr = subsData || []
        }
        setSubs(subsArr)
      } catch (e) {
        console.error('ERR_LOAD_STUDENT', e, e?.stack)
        setError(e?.message || 'Не удалось загрузить задания')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [myId])

  const subsMap = useMemo(
    () => Object.fromEntries((subs ?? []).map(s => [s.assignment_id, s])),
    [subs]
  )

  const statusFor = (a) => {
    const s = subsMap?.[a.id]
    if (!s) return { label: 'не сдано', color: 'bg-gray-50 text-gray-700' }
    if ((s.grade || '').trim()) return { label: `проверено (${s.grade})`, color: 'bg-green-50 text-green-700' }
    return { label: 'ожидает проверки', color: 'bg-yellow-50 text-yellow-700' }
  }

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
      const path = `private/${sid}/${assignment.id}-${Date.now()}-${safeName(file.name)}`

      const up = await supabase.storage.from('submissions').upload(path, file, { upsert: true })
      if (up.error) throw up.error

      const payload = {
        assignment_id: assignment.id,
        student_id: sid,
        file_path: path,
        updated_at: new Date().toISOString(),
      }
      const { error: upsertErr } = await supabase
        .from('submissions')
        .upsert(payload, { onConflict: 'assignment_id,student_id' })
      if (upsertErr) throw upsertErr

      if (typeof toast.success === 'function') toast.success('Работа отправлена')
      setBanner({ type: 'success', msg: 'Работа отправлена' })
      setConfirmId(null)
      setFileByAssignment(prev => ({ ...prev, [assignment.id]: null }))
      if (typeof refetchSubmissions === 'function') await refetchSubmissions()
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

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Мои задания</h2>
        <ul className="divide-y divide-gray-100">
          {assignments.map(a => {
            const st = statusFor(a)
            const material = a.material_id ? materialsMap[a.material_id] : null
            return (
              <li key={a.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-gray-500">Дедлайн: {a.due_date ? new Date(a.due_date).toLocaleString() : '—'}</div>
                  </div>
                  <span className={`rounded-xl px-3 py-1 text-sm ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {material && (
                    <button className="btn-outline" onClick={() => downloadMaterial(material)}>Скачать материал</button>
                  )}
                  <input type="file" onChange={(e) => setFileByAssignment(prev => ({ ...prev, [a.id]: e.target.files?.[0] || null }))} />
                  <button className="btn-outline" onClick={() => setConfirmId(a.id)}>Отправить</button>
                </div>
              </li>
            )
          })}
          {assignments.length === 0 && (
            <li className="py-8 text-center text-gray-500">Нет заданий</li>
          )}
        </ul>
      </section>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
            <div className="p-6 space-y-4">
              <div className="text-lg font-semibold">Отправить решение?</div>
              <div className="text-sm text-gray-600">Перед отправкой проверьте, что выбран корректный файл.</div>
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={() => setConfirmId(null)}>Отмена</button>
                <button className="btn-primary" onClick={() => {
                  const a = assignments.find(i => i.id === confirmId)
                  if (a) handleSubmit(a)
                }}>Отправить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {banner && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${banner.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{banner.msg}</div>
      )}
    </div>
  )
}