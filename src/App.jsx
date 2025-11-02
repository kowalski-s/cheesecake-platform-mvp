import { NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
import ForgotPassword from './pages/Auth/ForgotPassword'
import DashboardStudent from './pages/DashboardStudent'
import DashboardTeacher from './pages/DashboardTeacher'
import SchedulePage from './pages/Schedule'
import MaterialsPage from './pages/Materials'
import AdminPage from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'

function App() {
  const { profile } = useAuth()

  return (
    <div className="min-h-screen bg-surface">
      <Topbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {profile?.role === 'teacher' ? (
                  <DashboardTeacher />
                ) : (
                  <DashboardStudent />
                )}
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher"
            element={
              <ProtectedRoute>
                <DashboardTeacher />
              </ProtectedRoute>
            }
          />

          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <SchedulePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/materials"
            element={
              <ProtectedRoute>
                <MaterialsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RoleGuard allow={["admin"]}>
                  <AdminPage />
                </RoleGuard>
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function Topbar() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-10 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-brand" />
          <span className="font-semibold">Cheesecake School</span>
        </div>
        <nav className="flex items-center gap-4">
          <NavLink className="text-sm text-gray-600 hover:text-gray-900" to="/dashboard">Главная</NavLink>
          <NavLink className="text-sm text-gray-600 hover:text-gray-900" to="/schedule">Расписание</NavLink>
          <NavLink className="text-sm text-gray-600 hover:text-gray-900" to="/materials">Материалы</NavLink>
          {profile?.role === 'admin' && (
            <NavLink className="text-sm text-gray-600 hover:text-gray-900" to="/admin">Админ</NavLink>
          )}
          {profile && (
            <button
              className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-medium bg-brand text-white hover:bg-brand-muted"
              onClick={async () => { await signOut(); navigate('/login') }}
            >Выйти</button>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-4 text-sm text-gray-500">
        © {new Date().getFullYear()} Cheesecake School — MVP
      </div>
    </footer>
  )
}

export default App
