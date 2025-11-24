import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabaseClient"
import Avatar from "./ui/Avatar"

function getRoleLabel(role) {
  const normalized = role?.trim()?.toLowerCase() ?? null
  if (normalized === "teacher") return "преподаватель"
  if (normalized === "student") return "ученик"
  if (normalized === "admin") return "администратор"
  return ""
}

export default function UserMenu() {
  const { user, role, profile, session } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [teacherProfile, setTeacherProfile] = useState(null)
  const ref = useRef(null)

  // Загружаем данные преподавателя для получения avatar_url
  useEffect(() => {
    if (!user?.id || role?.trim()?.toLowerCase() !== 'teacher') return
    let alive = true
    const load = async () => {
      try {
        const { data } = await supabase
          .from('teachers')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle()
        if (alive && data) setTeacherProfile(data)
      } catch (e) {
        console.error('Failed to load teacher profile', e)
      }
    }
    load()
    return () => { alive = false }
  }, [user?.id, role])

  // Закрыть по Escape/клику вне
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false) }
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onClickOutside)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onClickOutside)
    }
  }, [])

  // Закрыть меню при навигации
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const normalizedRole = useMemo(() => role?.trim()?.toLowerCase() ?? null, [role])
  const displayName = teacherProfile?.display_name || profile?.display_name || ""
  const email = session?.user?.email || ""
  const avatarUrl = teacherProfile?.avatar_url || profile?.avatar_url || null
  const roleLabel = getRoleLabel(role)

  const profilePath = normalizedRole === "student" ? "/students/me" : normalizedRole === "teacher" ? "/teacher/profile" : normalizedRole === "admin" ? "/admin-profile" : "/"
  const analyticsPath = normalizedRole === "teacher" || normalizedRole === "admin" ? "/teacher/analytics" : null

  if (!user) {
    return null
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-full transition-transform duration-150 active:scale-95"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title={displayName || email}
      >
        <Avatar displayName={displayName} email={email} size="sm" avatarUrl={avatarUrl} />
      </button>
      {open && (
        <div 
          className="absolute right-0 mt-2 w-[280px] rounded-2xl border border-gray-200 bg-slate-50 shadow-lg z-50 overflow-hidden"
          style={{
            animation: 'fadeIn 0.15s ease-out forwards'
          }}
        >
          <div className="px-4 py-3 space-y-3">
            {/* Блок с информацией о пользователе */}
            <div className="flex items-center gap-3">
              <Avatar displayName={displayName} email={email} size="sm" avatarUrl={avatarUrl} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {displayName || email}
                </div>
                {displayName && roleLabel && (
                  <div className="text-xs text-gray-500 truncate">
                    {roleLabel}
                  </div>
                )}
                {email && displayName && (
                  <div className="text-xs text-gray-400 truncate mt-0.5">
                    {email}
                  </div>
                )}
              </div>
            </div>

            {/* Разделитель */}
            <div className="h-px bg-gray-200" />

            {/* Список пунктов меню */}
            <nav className="space-y-1">
              <NavLink
                className={({ isActive }) => `block w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-orange-50 text-orange-600" 
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                to={profilePath}
                onClick={() => setOpen(false)}
              >
                Профиль
              </NavLink>
              {analyticsPath && (
                <NavLink
                  className={({ isActive }) => `block w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    isActive 
                      ? "bg-orange-50 text-orange-600" 
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  to={analyticsPath}
                  onClick={() => setOpen(false)}
                >
                  Аналитика
                </NavLink>
              )}
              <button 
                className="block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer" 
                onClick={() => { 
                  console.log("TODO: settings")
                  setOpen(false)
                }}
              >
                Настройки
              </button>
              <NavLink
                className={({ isActive }) => `block w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-red-50 text-red-600" 
                    : "text-red-600 hover:bg-red-50"
                }`}
                to="/logout"
                onClick={() => setOpen(false)}
              >
                Выйти
              </NavLink>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}