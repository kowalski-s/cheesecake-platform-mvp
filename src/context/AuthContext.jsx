import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// TODO: мемоизировать профиль + кэшировать роль в sessionStorage
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // оставляем для совместимости Topbar, может быть null
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  // Минимальная инициализация без зависаний
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!isSupabaseConfigured || !supabase) {
          if (alive) { setUser(null); setRole(null); }
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        if (!alive) return;
        setSession(session ?? null);
        setUser(u);
        if (u) await ensureUserRowAndRole(u);
        else setRole(null);
      } finally {
        if (alive) setInitializing(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      const u = sess?.user ?? null;
      setSession(sess ?? null);
      setUser(u);
      if (u) ensureUserRowAndRole(u);
      else setRole(null);
    });
    return () => { alive = false; try { sub.subscription.unsubscribe(); } catch {} };
  }, []);

  // Упрощённый рефреш роли: читает users, создаёт строку при отсутствии
  async function ensureUserRowAndRole(u) {
    try {
      if (!isSupabaseConfigured || !supabase) return;
      const { data: row } = await supabase
        .from('users')
        .select('role')
        .eq('id', u.id)
        .maybeSingle();
      let roleVal = row?.role;
      if (!roleVal) {
        const { data: up } = await supabase
          .from('users')
          .upsert({ id: u.id, email: u.email, role: 'student' })
          .select('role')
          .single();
        roleVal = up?.role;
      }
      setRole(roleVal?.trim()?.toLowerCase() ?? null);
    } catch (e) {
      console.error('ensureUserRowAndRole failed', e);
      setRole(null);
    }
  }

  const signOut = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      setSession(null);
      setProfile(null);
    }
  };

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      initializing,
      user,
      role,
      isSupabaseConfigured,
      refreshRole: ensureUserRowAndRole,
      setUser,
      setRole,
      signOut,
    }),
    [session, profile, loading, initializing, user, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
