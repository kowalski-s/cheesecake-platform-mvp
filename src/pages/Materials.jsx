import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import Loading from '../components/ui/Loading'
import { useAuth } from '../context/AuthContext'
import MaterialsList from '@/components/materials/MaterialsList'
import MaterialUpload from '@/components/materials/MaterialUpload'

export default function MaterialsPage() {
  const { role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError('Supabase не настроен')
      return
    }
    setLoading(false)
  }, [])

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
        <div className="text-sm text-gray-500">Проверьте настройки Supabase</div>
      </div>
    )
  }

  // Пустое состояние обрабатывается ниже, доступ не ограничиваем — RLS применится автоматически

  return (
    <div className="space-y-6">
      {(role?.trim()?.toLowerCase() === 'teacher' || role?.trim()?.toLowerCase() === 'admin') && (
        <MaterialUpload onUploaded={() => { /* list updates handled inside MaterialsList via filters change triggers */ }} />
      )}

      <MaterialsList />
    </div>
  )
}