import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import Loading from '@/components/ui/Loading'

export default function AssignmentsStudentPage() {
  const { role } = useAuth()
  const isStudent = useMemo(() => (role || '').trim().toLowerCase() === 'student', [role])
  const [items, setItems] = useState([])
  const [subsMap, setSubsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [fileByAssignment, setFileByAssignment] = useState({})
  const [confirmId, setConfirmId] = useState(null)
  const [materialsMap, setMaterialsMap] = useState({})
  const [myId, setMyId] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) throw new Error('Не найден пользователь')
        // Мой student.id (через user_id)
        const { data: my } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        const sid = my?.id || user.id
        setMyId(sid)

        // Список назначенных мне заданий через assignment_targets
        const { data: targets, error: tErr } = await supabase
          .from('assignment_targets')
          .select('assignment_id, assignments(id, title, description, due_date, material_id, teacher_id)')
          .eq('student_id', sid)
          .order('assignments(due_date)', { ascending: true })
        if (tErr) throw tErr
        const list = (targets || []).map(t => t.assignments).filter(Boolean)
        setItems(list)

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
        let subs = []
        if (ids.length > 0) {
          const { data: subsData } = await supabase
            .from('submissions')
            .select('id, assignment_id, grade, feedback, file_path')
            .eq('student_id', sid)
            .in('assignment_id', ids)
          subs = subsData || []
        }
        const m = {}
        subs.forEach(s => { m[s.assignment_id] = s })
        setSubsMap(m)
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить задания')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statusFor = (a) => {
    const s = subsMap[a.id]
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

  const submitFile = async (assignment) => {
    try {
      const f = fileByAssignment[assignment.id]
      if (!f) { setToast({ type: 'error', msg: 'Выберите файл' }); return }
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      const sid = myId || uid
      const ts = Date.now()
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `private/${sid}/${assignment.id}-${ts}-${safeName}`
      const { error: upErr } = await supabase.storage.from('submissions').upload(path, f, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      // upsert submission
      const { data: existing } = await supabase.from('submissions').select('id').eq('assignment_id', assignment.id).eq('student_id', sid).limit(1)
      if (existing && existing.length > 0) {
        const { error: updErr } = await supabase.from('submissions').update({ file_path: path }).eq('id', existing[0].id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase.from('submissions').insert({ assignment_id: assignment.id, student_id: sid, file_path: path })
        if (insErr) throw insErr
      }
      setToast({ type: 'success', msg: 'Решение отправлено' })
      setConfirmId(null)
      setFileByAssignment(prev => ({ ...prev, [assignment.id]: null }))
      // refresh
      const { data: subs } = await supabase.from('submissions').select('id, assignment_id, grade, feedback, file_path').eq('student_id', sid)
      const m = {}
      (subs || []).forEach(s => { m[s.assignment_id] = s })
      setSubsMap(m)
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось отправить решение' })
    } finally {
      setTimeout(() => setToast(null), 2500)
    }
  }

  if (!isStudent) return <div className="card p-6 text-center">Доступ запрещён</div>
  if (loading) return <Loading message="Загрузка заданий..." />

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Мои задания</h2>
        <ul className="divide-y divide-gray-100">
          {items.map(a => {
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
          {items.length === 0 && (
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
                  const a = items.find(i => i.id === confirmId)
                  if (a) submitFile(a)
                }}>Отправить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
    </div>
  )
}