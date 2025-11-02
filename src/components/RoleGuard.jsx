import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleGuard({ allow = [], children }) {
  const { profile } = useAuth()
  if (!profile || !allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}