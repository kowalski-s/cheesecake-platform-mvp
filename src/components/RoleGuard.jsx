import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loading from './ui/Loading'

export default function RoleGuard({ allow = [], children }) {
  const { initializing, user, role } = useAuth()
  const [initDeadlinePassed, setInitDeadlinePassed] = useState(false)

  useEffect(() => {
    setInitDeadlinePassed(false)
    if (initializing) {
      const t = setTimeout(() => setInitDeadlinePassed(true), 5000)
      return () => clearTimeout(t)
    }
  }, [initializing])

  // Если не авторизованы — на /login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Пока идёт инициализация — до 5с показываем Loading
  if (initializing === true && !initDeadlinePassed) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loading />
      </div>
    )
  }

  const normalizedRole = role?.trim()?.toLowerCase() ?? null

  // Если после тайм-аута роль так и не определена — показываем 403
  if (user && normalizedRole == null && initDeadlinePassed) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Нет доступа</h2>
        <p className="text-gray-600">Роль не определена.</p>
      </div>
    )
  }

  // Если список allow задан и роль не входит — редиректим на главную
  if (Array.isArray(allow) && allow.length > 0 && !allow.includes(normalizedRole)) {
    return <Navigate to="/" replace />
  }

  return children
}