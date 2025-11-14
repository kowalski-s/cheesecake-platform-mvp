import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import toast from '@/lib/safeToast'

export default function MaterialsList() {
  const { role } = useAuth()
  const normalizedRole = useMemo(() => (role || '').trim().toLowerCase(), [role])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ className: '', type: '' })

  const pageSize = 50
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('materials')
        .select('id, title, description, file_path, storage_path, file_type, class_name, owner_id, visibility, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
      if (filters.className) {
        query = query.ilike('class_name', `%${filters.className}%`)
      }
      if (filters.type) {
        // prefer server-side filter if column exists
        query = query.ilike('file_type', `${filters.type}%`)
      }
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, count, error } = await query.range(from, to)
      if (error) throw error
      setItems(data || [])
      setTotal(count || 0)
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить список материалов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])
  useEffect(() => { setPage(0); load() }, [filters.className, filters.type])

  const remove = async (m) => {
    try {
      const path = m.file_path || m.storage_path
      if (path) {
        const { error: rmErr } = await supabase.storage.from('materials').remove([path])
        if (rmErr) throw rmErr
      }
      const { error } = await supabase.from('materials').delete().eq('id', m.id)
      if (error) throw error
      toast.success('Материал удалён')
      await load()
    } catch (e) {
      toast.error(e?.message || 'Удаление не удалось')
    }
  }

  const publicUrl = (m) => {
    const path = m.file_path || m.storage_path
    if (!path) return null
    return supabase.storage.from('materials').getPublicUrl(path).data.publicUrl
  }

  const filteredClientSide = useMemo(() => {
    if (!filters.type || items.length === 0) return items
    return items.filter((m) => (m.file_type || '').startsWith(filters.type))
  }, [items, filters.type])

  const canDelete = (m) => ['teacher', 'admin'].includes(normalizedRole) && !!m.owner_id

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))

  return (
    <section className="card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex flex-wrap items-end gap-3 lg:flex-nowrap lg:gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Класс</label>
            <input className="input" value={filters.className} onChange={(e) => setFilters({ ...filters, className: e.target.value })} placeholder="например HSK1" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Тип</label>
            <select className="input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">Все</option>
              <option value="image/">Изображение</option>
              <option value="video/">Видео</option>
              <option value="application/pdf">PDF</option>
            </select>
          </div>
        </div>
        <div className="mt-2 sm:mt-2 lg:mt-0 self-center sm:self-end min-h-[40px] flex items-center justify-center sm:justify-end gap-2">
          <button className="btn-outline min-w-[84px]" onClick={() => { setPage(Math.max(0, page - 1)); }} disabled={page === 0} aria-label="Предыдущая страница" title="Предыдущая страница">Назад</button>
          <span className="text-sm text-gray-600">Стр. {page + 1} / {totalPages}</span>
          <button className="btn-outline min-w-[84px]" onClick={() => { const next = Math.min(totalPages - 1, page + 1); setPage(next) }} disabled={(page + 1) >= totalPages} aria-label="Следующая страница" title="Следующая страница">Вперёд</button>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 mt-4">
        {loading && <li className="col-span-3 py-6 text-center text-sm text-gray-500">Загрузка…</li>}
        {error && <li className="col-span-3 py-6 text-center text-sm text-red-600">{error}</li>}
        {!loading && !error && filteredClientSide.map((m) => (
          <li key={m.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
            <div className="font-medium">{m.title || '—'}</div>
            <div className="text-xs text-gray-500">{m.file_type || 'unknown'} • {m.class_name || '—'} • {m.visibility || '—'}</div>
            <div className="text-xs text-gray-400">{m.created_at ? new Date(m.created_at).toLocaleString() : '—'}</div>
            <Preview path={publicUrl(m)} type={m.file_type} />
            <div className="flex items-center gap-2">
              {publicUrl(m) && (
                <a className="btn-outline" href={publicUrl(m)} target="_blank" rel="noreferrer">Скачать</a>
              )}
              {canDelete(m) && (
                <button className="btn-outline" onClick={() => remove(m)}>Удалить</button>
              )}
            </div>
          </li>
        ))}
        {!loading && !error && filteredClientSide.length === 0 && (
          <li className="text-center p-8 col-span-3">
            <div className="mb-2 text-sm text-gray-500">Нет материалов по выбранным фильтрам</div>
          </li>
        )}
      </ul>

    </section>
  )
}

function Preview({ path, type }) {
  if (!path) return null
  if ((type || '').startsWith('image/')) {
    return <img src={path} alt="preview" className="mt-2 h-32 w-full object-cover rounded-lg" />
  }
  if ((type || '').startsWith('video/')) {
    return (
      <video className="mt-2 w-full rounded-lg" controls>
        <source src={path} type={type} />
      </video>
    )
  }
  if ((type || '') === 'application/pdf') {
    return <iframe src={path} title="PDF" className="mt-2 w-full h-40 rounded-lg" />
  }
  return null
}