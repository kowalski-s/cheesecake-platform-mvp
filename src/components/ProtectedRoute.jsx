import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/ui/Loading'

export default function ProtectedRoute({ children }) {
  const { session, loading, isSupabaseConfigured } = useAuth()
  if (!isSupabaseConfigured) {
    return <Loading message="Нет подключения к базе, проверь переменные окружения" />
  }
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  return children
}