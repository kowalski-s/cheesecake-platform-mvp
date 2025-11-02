import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // { id, role, display_name, student_id?, teacher_id? }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id)
      }
      setLoading(false)
    }
    init()

    if (isSupabaseConfigured && supabase) {
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
    }
  }, [])

  const loadProfile = async (userId) => {
    try {
      // Пытаемся получить профиль из базы
      const { data, error } = await supabase
        .from('users')
        .select('id, role, display_name, student_id, teacher_id')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        // Профиль найден в базе
        setProfile(data)
      } else {
        // Профиль НЕ найден - создаем временный профиль
        // Это решает проблему бесконечной загрузки, когда строки в public.users нет
        const user = (await supabase.auth.getUser()).data.user
        setProfile({
          id: userId,
          role: 'student', // По умолчанию роль student
          display_name: user?.email?.split('@')[0] || 'Пользователь',
          student_id: null,
          teacher_id: null
        })
      }
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err)
      // Даже при ошибке создаем временный профиль
      setProfile({
        id: userId,
        role: 'student',
        display_name: 'Пользователь',
        student_id: null,
        teacher_id: null
      })
    }
  }

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    }
    setSession(null)
    setProfile(null)
  }

  const value = useMemo(() => ({ session, profile, loading, isSupabaseConfigured, signOut }), [session, profile, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)