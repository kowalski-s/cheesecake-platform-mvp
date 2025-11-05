import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import Loading from '../components/ui/Loading'
import { useAuth } from '../context/AuthContext'

export default function MaterialsPage() {
  const { role } = useAuth()
  // TODO: доступ только при назначенном teacher_id; список файлов из supabase.storage('materials'); загрузка/просмотр
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        setError('Supabase не настроен')
        return
      }
      try {
        await withTimeout(loadFiles(), 8000)
      } catch (err) {
        console.error('Ошибка загрузки данных:', err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const loadFiles = async () => {
    try {
      const { data, error } = await withTimeout(supabase.storage.from('materials').list('public', { limit: 100 }), 8000)
      if (!error) setFiles(data || [])
      else setFiles([])
    } catch (err) {
      console.error('Ошибка загрузки файлов:', err)
      setError('Не удалось загрузить файлы')
      setFiles([])
    }
  }

  const upload = async (e) => {
    e.preventDefault()
    if (!file) return
    try {
      const user = (await withTimeout(supabase.auth.getUser(), 8000)).data.user
      const fileName = `${user?.id}-${Date.now()}-${file.name}`
      const { error } = await withTimeout(supabase.storage.from('materials').upload(`public/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      }), 8000)
      if (!error) {
        setFile(null)
        await loadFiles()
      }
    } catch (err) {
      console.error('Ошибка загрузки файла:', err)
      setError('Не удалось загрузить файл')
    }
  }

  if (loading) {
    return <Loading message="Загрузка материалов..." />
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Не удалось загрузить материалы</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={() => loadFiles()} className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand-muted">
          Попробовать снова
        </button>
      </div>
    )
  }

  // Пустое состояние обрабатывается ниже, доступ не ограничиваем — RLS применится автоматически

  return (
    <div className="space-y-6">
      {(role?.trim()?.toLowerCase() === 'teacher' || role?.trim()?.toLowerCase() === 'admin') && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Загрузить материал</h2>
          <form className="flex items-center gap-3" onSubmit={upload}>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button className="btn-primary">Загрузить</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Материалы</h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {files.map((f) => (
            <li key={f.name} className="rounded-xl border border-gray-100 p-3">
              <div className="font-medium">{f.name}</div>
              <a
                className="text-sm text-brand hover:text-brand-muted"
                href={supabase.storage.from('materials').getPublicUrl(`public/${f.name}`).data.publicUrl}
                target="_blank"
                rel="noreferrer"
              >Скачать / Открыть</a>
            </li>
          ))}
          {files.length === 0 && (
            <li className="text-center p-8 col-span-3">
              <div className="mb-4 mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p className="text-gray-500">Пока нет доступных материалов</p>
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}