import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function MaterialsPage() {
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [canAccess, setCanAccess] = useState(false)

  useEffect(() => {
    const init = async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return
      // allow access only if student has assigned teacher
      const { data: student } = await supabase.from('students').select('id, teacher_id').eq('id', user.id).maybeSingle()
      setCanAccess(!!student?.teacher_id)
      await loadFiles()
    }
    init()
  }, [])

  const loadFiles = async () => {
    const { data, error } = await supabase.storage.from('materials').list('public', { limit: 100 })
    if (!error) setFiles(data || [])
  }

  const upload = async (e) => {
    e.preventDefault()
    if (!file) return
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
  }

  if (!canAccess) {
    return (
      <div className="card">
        Доступ к материалам откроется после назначения преподавателя.
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
          {files.length === 0 && <li className="text-sm text-gray-500">Пока пусто</li>}
        </ul>
      </section>
    </div>
  )
}