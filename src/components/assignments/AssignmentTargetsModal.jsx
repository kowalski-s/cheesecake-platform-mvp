import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast from '@/lib/safeToast'

export default function AssignmentTargetsModal({ visible, assignment, onClose, onAssigned }) {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadStudents = async () => {
      if (!visible) return
      setLoading(true)
      setError(null)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id
        const { data, error: sErr } = await supabase.from('students').select('id, display_name').eq('teacher_id', uid).order('display_name')
        if (sErr) throw sErr
        setStudents(data || [])
        setSelected({})
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить список учеников')
      } finally {
        setLoading(false)
      }
    }
    loadStudents()
  }, [visible])

  const toggle = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const confirm = async () => {
    try {
      const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
      if (!assignment?.id || ids.length === 0) { toast.error('Выберите хотя бы одного ученика'); return }
      const rows = ids.map(sid => ({ assignment_id: assignment.id, student_id: sid }))
      const { error: upErr } = await supabase.from('assignment_targets').upsert(rows, { onConflict: 'assignment_id,student_id', returning: 'minimal' })
      if (upErr) throw upErr
      toast.success('Назначено')
      if (typeof onAssigned === 'function') onAssigned(rows)
      if (typeof onClose === 'function') onClose()
    } catch (e) {
      toast.error(e?.message || 'Не удалось назначить')
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Назначить: {assignment?.title}</h3>
          {loading ? (
            <div className="text-sm text-gray-500">Загрузка…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {students.map(s => (
                <li key={s.id} className="py-2">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggle(s.id)} />
                    <span>{s.display_name || s.id}</span>
                  </label>
                </li>
              ))}
              {students.length === 0 && <li className="py-4 text-center text-sm text-gray-500">Нет учеников</li>}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={onClose}>Отмена</button>
            <button className="btn-primary" onClick={confirm}>Назначить</button>
          </div>
        </div>
      </div>
    </div>
  )
}