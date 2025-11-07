import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import Loading from '../components/ui/Loading'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

export default function AdminLessonsPage() {
  const { role, user } = useAuth()
  const normalizedRole = useMemo(() => role?.trim()?.toLowerCase() ?? null, [role])
  const canCreate = normalizedRole === 'admin' || normalizedRole === 'teacher'
  const [filters, setFilters] = useState({ teacher: '', className: '', status: '', from: '', to: '' })
  const [lessons, setLessons] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [teacherSelfId, setTeacherSelfId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [creating, setCreating] = useState({
    title: '',
    class_name: '',
    start_at: '',
    duration: '',
    teacher_id: '',
    student_id: '',
    notes: '',
    status: 'planned',
  })

  const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        setError('Supabase не настроен')
        return
      }
      try {
        const { data: ts } = await withTimeout(supabase.from('teachers').select('id, display_name').order('display_name'), 8000)
        setTeachers(ts || [])

        // resolve current teacher record id for teacher role
        let myTeacherId = null
        if (normalizedRole === 'teacher' && user?.id) {
          const { data: meT } = await withTimeout(
            supabase.from('teachers').select('id').eq('user_id', user.id).maybeSingle(),
            8000
          )
          myTeacherId = meT?.id || null
          setTeacherSelfId(myTeacherId)
        }

        // load students list for creation; teachers see only own students
        let sQuery = supabase.from('students').select('id, display_name').order('display_name')
        if (normalizedRole === 'teacher' && myTeacherId) {
          sQuery = sQuery.eq('teacher_id', myTeacherId)
        }
        const { data: ss } = await withTimeout(sQuery, 8000)
        setStudents(ss || [])

        await load()
      } catch (err) {
        console.error('Ошибка загрузки данных:', err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const load = async (override) => {
    try {
      setLoading(true)
      const f = override ?? filters
      let query = supabase
        .from('lessons')
        .select('id, title, class_name, start_at, duration, status, notes, teacher_id, student_id, teacher:teachers(display_name), student:students(display_name)')
        .order('start_at', { ascending: true })
      if (f.teacher) query = query.eq('teacher_id', f.teacher)
      if (f.className) query = query.ilike('class_name', `%${f.className}%`)
      if (f.status) query = query.eq('status', f.status)
      if (f.from) query = query.gte('start_at', new Date(f.from).toISOString())
      if (f.to) query = query.lte('start_at', new Date(f.to).toISOString())
      const { data, error: qError } = await withTimeout(query, 8000)
      if (qError) throw qError
      setLessons(data || [])
    } catch (err) {
      console.error('Ошибка загрузки занятий:', err)
      setError('Не удалось загрузить занятия')
    } finally {
      setLoading(false)
    }
  }

  const updateFilter = (field, value) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    load(next)
  }

  const createLesson = async () => {
    try {
      if (!canCreate) return
      const payload = {
        title: creating.title.trim(),
        class_name: creating.class_name.trim() || null,
        start_at: creating.start_at ? new Date(creating.start_at).toISOString() : new Date().toISOString(),
        duration: creating.duration ? Number(creating.duration) : null,
        teacher_id: creating.teacher_id || (normalizedRole === 'teacher' ? teacherSelfId : null),
        student_id: creating.student_id || null,
        notes: creating.notes?.trim() || null,
        status: creating.status || 'planned',
      }
      if (!payload.title || !payload.teacher_id || !payload.student_id) {
        setToast({ type: 'error', msg: 'Укажите тему, преподавателя и ученика' })
        return
      }
      const { error: insError } = await supabase.from('lessons').insert(payload)
      if (insError) throw insError
      setToast({ type: 'success', msg: 'Занятие создано' })
      setCreating({ title: '', class_name: '', start_at: '', duration: '', teacher_id: '', student_id: '', notes: '', status: 'planned' })
      await load()
    } catch (e) {
      console.error('create lesson failed', e)
      setToast({ type: 'error', msg: 'Не удалось создать занятие' })
    }
  }

  const setStatus = async (lessonId, status) => {
    try {
      const { error: updError } = await supabase.from('lessons').update({ status }).eq('id', lessonId)
      if (updError) throw updError
      setLessons(lessons.map(l => l.id === lessonId ? { ...l, status } : l))
    } catch (e) {
      console.error('update status failed', e)
      setToast({ type: 'error', msg: 'Не удалось обновить статус' })
    }
  }

  const removeLesson = async (lessonId) => {
    try {
      const { error: delError } = await supabase.from('lessons').delete().eq('id', lessonId)
      if (delError) throw delError
      setLessons(lessons.filter(l => l.id !== lessonId))
      setToast({ type: 'success', msg: 'Занятие удалено' })
    } catch (e) {
      console.error('delete lesson failed', e)
      setToast({ type: 'error', msg: 'Не удалось удалить занятие' })
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Loading message="Загрузка занятий..." />
      ) : error ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => load()} className="btn-primary">Попробовать снова</button>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Преподаватель</label>
                <select className="input" value={filters.teacher} onChange={(e) => updateFilter('teacher', e.target.value)}>
                  <option value="">Все</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Класс</label>
                <input className="input" value={filters.className} onChange={(e) => updateFilter('className', e.target.value)} placeholder="например HSK1" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Статус</label>
                <select className="input" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                  <option value="">Любой</option>
                  <option value="planned">Запланировано</option>
                  <option value="done">Проведено</option>
                  <option value="canceled">Отменено</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Дата от</label>
                <input type="date" className="input" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Дата до</label>
                <input type="date" className="input" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
              </div>
            </div>
          </section>

          {canCreate && (
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold">Создать занятие</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Тема</label>
                  <input className="input" value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Класс</label>
                  <input className="input" value={creating.class_name} onChange={(e) => setCreating({ ...creating, class_name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Начало</label>
                  <input type="datetime-local" className="input" value={creating.start_at} onChange={(e) => setCreating({ ...creating, start_at: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Длительность (мин)</label>
                  <input type="number" className="input" value={creating.duration} onChange={(e) => setCreating({ ...creating, duration: e.target.value })} />
                </div>
                {normalizedRole === 'admin' && (
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Преподаватель</label>
                    <select className="input" value={creating.teacher_id || ''} onChange={(e) => setCreating({ ...creating, teacher_id: e.target.value || '' })}>
                      <option value="">Выберите</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Ученик</label>
                  <select className="input" value={creating.student_id || ''} onChange={(e) => setCreating({ ...creating, student_id: e.target.value || '' })}>
                    <option value="">Выберите</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                  <label className="mb-1 block text-sm text-gray-600">Заметки</label>
                  <textarea className="input" rows={2} value={creating.notes} onChange={(e) => setCreating({ ...creating, notes: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Статус</label>
                  <select className="input" value={creating.status} onChange={(e) => setCreating({ ...creating, status: e.target.value })}>
                    <option value="planned">Запланировано</option>
                    <option value="done">Проведено</option>
                    <option value="canceled">Отменено</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button className="btn-primary" onClick={createLesson}>Создать</button>
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Занятия</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тема</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Класс</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Начало</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Длительность</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Преподаватель</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ученик</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lessons.map(l => (
                    <tr key={l.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{l.title}</div>
                        <div className="text-xs text-gray-400">{l.id}</div>
                      </td>
                      <td className="px-4 py-2">{l.class_name}</td>
                      <td className="px-4 py-2">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')}</td>
                      <td className="px-4 py-2">{l.duration ? `${l.duration} мин` : '-'}</td>
                      <td className="px-4 py-2">{l.teacher?.display_name}</td>
                      <td className="px-4 py-2">{l.student?.display_name}</td>
                      <td className="px-4 py-2">
                        <select className="input w-36" value={l.status} onChange={(e) => setStatus(l.id, e.target.value)}>
                          <option value="planned">Запланировано</option>
                          <option value="done">Проведено</option>
                          <option value="canceled">Отменено</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button className="btn-outline" onClick={() => removeLesson(l.id)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                  {lessons.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Нет занятий по выбранным фильтрам</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {toast && (
            <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast?.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast?.msg}</div>
          )}
        </>
      )}
    </div>
  )
}