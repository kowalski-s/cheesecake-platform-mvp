import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import Loading from '../components/ui/Loading'

export default function MaterialsPage() {
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [canAccess, setCanAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        setError('Supabase не настроен')
        return
      }
      
      try {
        const user = (await supabase.auth.getUser()).data.user
        if (!user) {
          setCanAccess(false)
          return
        }
        // allow access only if student has assigned teacher
        const { data: student } = await supabase.from('students').select('id, teacher_id').eq('id', user.id).maybeSingle()
        setCanAccess(!!student?.teacher_id)
        await loadFiles()
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
      const { data, error } = await supabase.storage.from('materials').list('public', { limit: 100 })
      if (!error) setFiles(data || [])
    } catch (err) {
      console.error('Ошибка загрузки файлов:', err)
      setError('Не удалось загрузить файлы')
    }
  }

  const upload = async (e) => {
    e.preventDefault()
    if (!file) return
    try {
      const user = (await supabase.auth.getUser()).data.user
      const fileName = `${user?.id}-${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('materials').upload(`public/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      })
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

  if (!canAccess) {
    return (
      <div className="card p-8 text-center">
        <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-yellow-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Доступ ограничен</h2>
        <p className="text-gray-600">Доступ к материалам откроется после назначения преподавателя.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Загрузить материал</h2>
        <form className="flex items-center gap-3" onSubmit={upload}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn-primary">Загрузить</button>
        </form>
      </section>

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