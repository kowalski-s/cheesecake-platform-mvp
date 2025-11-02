import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // { id, role, display_name, student_id?, teacher_id? }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      authListener.subscription?.unsubscribe()
    }
  }, [])

  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, role, display_name, student_id, teacher_id')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
  }

  const value = useMemo(() => ({ session, profile, loading }), [session, profile, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)