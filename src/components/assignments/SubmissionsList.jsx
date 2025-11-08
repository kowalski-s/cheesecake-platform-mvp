import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SubmissionsList({ assignment }) {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, student_id, file_path, grade, feedback, created_at, updated_at')
        .eq('assignment_id', assignment?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSubs(data || [])
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить решения')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (assignment?.id) load() }, [assignment?.id])

  const saveReview = async (id, grade, feedback) => {
    try {
      const { error } = await supabase.from('submissions').update({ grade: (grade || null), feedback: (feedback || null) }).eq('id', id)
      if (error) throw error
      setToast({ type: 'success', msg: 'Оценка сохранена' })
      await load()
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Не удалось сохранить оценку' })
    } finally {
      setTimeout(() => setToast(null), 2500)
    }
  }

  const signedUrl = async (path) => {
    try {
      const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, 60 * 10)
      if (error) return null
      return data?.signedUrl || null
    } catch { return null }
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Решения</h2>
      {loading && <div className="py-4 text-center text-sm text-gray-500">Загрузка…</div>}
      {error && <div className="py-4 text-center text-sm text-red-600">{error}</div>}
      {!loading && !error && (
        <ul className="divide-y divide-gray-100">
          {subs.map(s => (
            <li key={s.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Студент: {s.student_id}</div>
                  <div className="text-xs text-gray-400">{s.updated_at ? new Date(s.updated_at).toLocaleString() : s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</div>
                </div>
                {s.file_path && (
                  <AsyncLink path={s.file_path} signedUrlFn={signedUrl} />
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Оценка</label>
                  <input className="input" defaultValue={s.grade || ''} onBlur={(e) => saveReview(s.id, e.target.value, s.feedback)} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-600">Комментарий</label>
                  <textarea className="input" defaultValue={s.feedback || ''} onBlur={(e) => saveReview(s.id, s.grade, e.target.value)} />
                </div>
              </div>
            </li>
          ))}
          {subs.length === 0 && (
            <li className="py-8 text-center text-gray-500">Нет решений</li>
          )}
        </ul>
      )}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
    </section>
  )
}

function AsyncLink({ path, signedUrlFn }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { (async () => { setUrl(await signedUrlFn(path)) })() }, [path])
  if (!url) return <span className="text-xs text-gray-400">Готовим ссылку…</span>
  return <a className="btn-outline" href={url} target="_blank" rel="noreferrer">Скачать</a>
}