import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function UserMenu() {
  const { user, role, profile, session } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

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

  const normalizedRole = useMemo(() => role?.trim()?.toLowerCase() ?? null, [role])
  const displayName = profile?.display_name || ""
  const email = session?.user?.email || ""
  const initials = useMemo(() => {
    const name = displayName.trim()
    if (name) {
      const parts = name.split(/\s+/)
      const first = parts[0]?.[0] || ""
      const second = parts.length > 1 ? parts[1]?.[0] || "" : ""
      const res = `${first}${second}`.toUpperCase()
      if (res) return res
    }
    const letter = email.split("@")[0]?.[0] || "?"
    return String(letter).toUpperCase()
  }, [displayName, email])

  const profilePath = normalizedRole === "student" ? "/students/me" : normalizedRole === "teacher" ? "/teacher/profile" : normalizedRole === "admin" ? "/admin-profile" : "/"

  if (!user) {
    return null
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="hidden md:flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-700 font-semibold"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title={displayName || email}
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white shadow-lg p-1 z-50">
          <NavLink
            className={({ isActive }) => `block rounded-lg px-3 py-2 ${isActive ? "bg-brand/10 text-brand font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
            to={profilePath}
            onClick={() => setOpen(false)}
          >
            Профиль
          </NavLink>
          <button className="block w-full text-left rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-50" onClick={() => setOpen(false)}>Настройки</button>
          <div className="my-1 h-px bg-gray-200" />
          <NavLink
            className={({ isActive }) => `block rounded-lg px-3 py-2 ${isActive ? "bg-brand/10 text-brand font-semibold" : "text-red-600 hover:bg-red-50"}`}
            to="/logout"
            onClick={() => setOpen(false)}
          >
            Выйти
          </NavLink>
        </div>
      )}
    </div>
  )
}