import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import toast from '@/lib/safeToast'

export default function MaterialUpload({ onUploaded }) {
  const { role } = useAuth()
  const canUpload = ['teacher', 'admin'].includes((role || '').trim().toLowerCase())

  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [className, setClassName] = useState('')
  const [visibility, setVisibility] = useState('public')
  const dropRef = useRef(null)

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e) => { e.preventDefault(); el.classList.add('ring-2', 'ring-orange-400') }
    const onDragLeave = () => { el.classList.remove('ring-2', 'ring-orange-400') }
    const onDrop = (e) => {
      e.preventDefault()
      el.classList.remove('ring-2', 'ring-orange-400')
      const f = e.dataTransfer?.files?.[0]
      if (f) setFile(f)
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])

  const ensureBuckets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      await fetch('/.netlify/functions/storage-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'ensure_buckets' }),
      })
    } catch {}
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canUpload) return
    if (!file) { toast.error('Выберите файл'); return }
    try {
      await ensureBuckets()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      const ts = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `public/${userId}/${ts}-${safeName}`
      const { error: upErr } = await supabase.storage.from('materials').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr

      const payload = {
        title: title?.trim() || safeName,
        description: description?.trim() || null,
        file_path: path,
        storage_path: path,
        file_type: file.type || null,
        class_name: className?.trim() || null,
        owner_id: userId,
        visibility: visibility,
      }

      const { error: insErr } = await supabase.from('materials').insert(payload)
      if (insErr) throw insErr
      toast.success('Материал загружен')
      setFile(null); setTitle(''); setDescription(''); setClassName(''); setVisibility('public')
      if (typeof onUploaded === 'function') onUploaded()
    } catch (err) {
      console.error('upload material failed', err)
      toast.error(err?.message || 'Не удалось загрузить материал')
    }
  }

  if (!canUpload) return null

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Загрузить материал</h2>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div ref={dropRef} className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm text-gray-600 mb-2">Перетащите файл сюда или выберите вручную</p>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file && <div className="mt-2 text-xs text-gray-500">Выбран: {file.name} ({file.type || 'unknown'})</div>}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Название</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Урок 1 — алфавит" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Класс (группа)</label>
            <input className="input" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="например HSK1" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Описание</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Короткое описание материала" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Видимость</label>
          <select className="input w-48" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">public</option>
            <option value="students">students</option>
            <option value="teachers">teachers</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="submit" className="btn-primary">Загрузить</button>
        </div>
      </form>

    </section>
  )
}