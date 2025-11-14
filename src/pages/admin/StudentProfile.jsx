import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Loading from '../../components/ui/Loading'
import toast from '@/lib/safeToast'

function daysUntil(date) {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.ceil(ms / (24 * 3600 * 1000))
}

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }

export default function StudentProfile() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [email, setEmail] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [subForm, setSubForm] = useState({ remaining_lessons: 0, endDate: '' })

  const subEnd = useMemo(() => subscription ? addDays(new Date(subscription.created_at), 30) : null, [subscription])
  const daysLeft = useMemo(() => subEnd ? daysUntil(subEnd) : null, [subEnd])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1) Load student first to get linked user_id
      const { data: stu, error: stuErr } = await supabase
        .from('students')
        .select('id, display_name, teacher_id, remaining_lessons, user_id, teacher:teachers(id, display_name)')
        .eq('id', id)
        .maybeSingle()
      if (stuErr) throw stuErr
      if (!stu) throw new Error('Ученик не найден')
      setStudent(stu)

      // 2) In parallel: subscriptions by user_id, recent lessons, and user email from v_users_full
      const [subRes, lesRes, userRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('id, name, remaining_lessons, active, created_at')
          .eq('user_id', stu.user_id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('lessons')
          .select('id, title, class_name, start_at, status, teacher:teachers(display_name)')
          .eq('student_id', id)
          .order('start_at', { ascending: false })
          .limit(10),
        supabase
          .from('v_users_full')
          .select('id, email')
          .eq('id', stu.user_id)
          .maybeSingle(),
      ])

      const sub = Array.isArray(subRes.data) && subRes.data.length > 0 ? subRes.data[0] : null
      setSubscription(sub)
      setLessons(lesRes.data || [])
      const urow = userRes?.data || null
      setEmail(urow?.email || null)
      if (sub) setSubForm({ remaining_lessons: sub.remaining_lessons || 0, endDate: addDays(new Date(sub.created_at), 30).toISOString().slice(0, 10) })
    } catch (e) {
      console.error('load student profile failed', e)
      setError(e?.message || 'Не удалось загрузить профиль')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const saveSubscription = async () => {
    try {
      if (!student?.id) return
      const remaining = Number(subForm.remaining_lessons) || 0
      const endDate = subForm.endDate ? new Date(subForm.endDate) : null
      const startForEnd = endDate ? new Date(endDate.getTime() - 30 * 24 * 3600 * 1000) : new Date()
      const payload = { remaining_lessons: remaining, active: true, name: subscription?.name || 'Абонемент', created_at: startForEnd.toISOString() }
      if (subscription?.id) {
        const { error } = await supabase.from('subscriptions').update(payload).eq('id', subscription.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subscriptions').insert({ user_id: student.user_id, ...payload })
        if (error) throw error
      }
      toast.success('Абонемент обновлён')
      setEditing(false)
      await load()
    } catch (e) {
      console.error('save subscription failed', e)
      toast.error(`Ошибка сохранения абонемента: ${e?.message || 'неизвестная ошибка'}`)
    }
  }

  if (loading) return <div className="py-10"><Loading /></div>
  if (error) return <div className="card p-6 text-center text-red-600">{error}</div>

  const remaining = subscription?.remaining_lessons ?? student?.remaining_lessons ?? 0
  const warnRemaining = typeof remaining === 'number' && remaining < 14
  const warnDays = typeof daysLeft === 'number' && daysLeft < 14

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ученик: {student?.display_name || student?.id}</h1>
          <p className="text-gray-600 text-sm">ID: {student?.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline" onClick={() => setEditing(true)}>Изменить абонемент</button>
        </div>
      </header>

      <section className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-medium">{email || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Преподаватель</div>
            <div className="font-medium">{student?.teacher?.display_name || 'Не назначен'}{student?.teacher?.id ? ' ' : ''}{student?.teacher?.id ? (<Link className="text-orange-600" to={`/admin/teachers/${student.teacher.id}`}>→ профиль</Link>) : null}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Осталось занятий</div>
            <div className={`font-semibold ${warnRemaining ? 'text-red-600' : ''}`}>{remaining}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">До даты абонемента</div>
            <div className={`font-semibold ${warnDays ? 'text-red-600' : ''}`}>{subEnd ? `${daysLeft} дн.` : '—'}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">10 последних занятий</h2>
        <ul className="divide-y divide-gray-100">
          {lessons.map(l => (
            <li key={l.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{l.title}</div>
                <div className="text-sm text-gray-500">{new Date(l.start_at).toLocaleString()} • {l.class_name} • {l.teacher?.display_name}</div>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{l.status}</div>
            </li>
          ))}
          {lessons.length === 0 && <li className="py-3 text-sm text-gray-500">Нет данных</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">История/прогресс</h2>
        <div className="text-sm text-gray-600">Заглушка</div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
            <button onClick={() => setEditing(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Редактировать абонемент</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Осталось занятий</label>
                <input type="number" className="input" value={subForm.remaining_lessons} onChange={(e) => setSubForm({ ...subForm, remaining_lessons: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дата окончания</label>
                <input type="date" className="input" value={subForm.endDate} onChange={(e) => setSubForm({ ...subForm, endDate: e.target.value })} />
                <p className="mt-1 text-xs text-gray-500">Технически рассчитывается как 30 дней от даты начала.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={() => setEditing(false)}>Отмена</button>
                <button className="btn-primary" onClick={saveSubscription}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}