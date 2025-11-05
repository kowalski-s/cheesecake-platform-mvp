import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

export default function Logout() {
  const nav = useNavigate()
  const { setRole, setUser } = (useAuth?.() ?? {})

  useEffect(() => {
    ;(async () => {
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.error('logout failed', e)
      } finally {
        setRole?.(null); setUser?.(null)
        nav('/login', { replace: true })
      }
    })()
  }, [])

  return (
    <div className="flex justify-center items-center py-20">
      <div className="mx-auto mt-24 w-40 rounded-xl bg-white p-4 text-center shadow">Выходим…</div>
    </div>
  )
}