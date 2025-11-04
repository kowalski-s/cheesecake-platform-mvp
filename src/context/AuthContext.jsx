import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// TODO: мемоизировать профиль + кэшировать роль в sessionStorage
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { id, role, display_name, student_id?, teacher_id? }
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let unsub = null;

    const boot = async () => {
      setInitializing(true);
      // 1) Если Supabase не настроен — сразу выходим из «загрузки»
      if (!isSupabaseConfigured || !supabase) {
        console.log('Supabase не сконфигурирован');
        setSession(null);
        setProfile(null);
        setLoading(false);
        setInitializing(false);
        return;
      }

      try {
        setLoading(true);

        // 2) Получаем текущую сессию
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Ошибка получения сессии:', error);
          setSession(null);
          setProfile(null);
        } else {
          const sess = data?.session ?? null;
          setSession(sess);

          // 3) Если есть пользователь — грузим профиль (с временной подстраховкой)
          if (sess?.user) {
            try {
              const { data: row, error: roleError } = await supabase
                .from('users')
                .select('id, role, display_name, student_id, teacher_id')
                .eq('id', sess.user.id)
                .maybeSingle();

              if (roleError) {
                console.error('Ошибка получения роли:', roleError);
              }

              setProfile(
                row ?? {
                  id: sess.user.id,
                  role: null,
                  display_name: sess.user.email?.split('@')[0] || 'Пользователь',
                  student_id: null,
                  teacher_id: null,
                }
              );
            } catch (profileError) {
              console.error('Ошибка загрузки профиля:', profileError);
              setProfile({
                id: sess.user.id,
                role: null,
                display_name: sess.user.email?.split('@')[0] || 'Пользователь',
                student_id: null,
                teacher_id: null,
              });
            }
          } else {
            setProfile(null);
          }
        }

        // 4) Подписка на изменения авторизации
        const sub = supabase.auth.onAuthStateChange(async (_event, sess) => {
          setSession(sess ?? null);

          if (sess?.user) {
            try {
              const { data: row, error: roleError } = await supabase
                .from('users')
                .select('id, role, display_name, student_id, teacher_id')
                .eq('id', sess.user.id)
                .maybeSingle();

              if (roleError) {
                console.error('Ошибка получения роли при смене состояния:', roleError);
              }

              setProfile(
                row ?? {
                  id: sess.user.id,
                  role: null,
                  display_name: sess.user.email?.split('@')[0] || 'Пользователь',
                  student_id: null,
                  teacher_id: null,
                }
              );
            } catch (error) {
              console.error('Ошибка загрузки профиля при смене состояния:', error);
              setProfile({
                id: sess.user.id,
                role: null,
                display_name: sess.user.email?.split('@')[0] || 'Пользователь',
                student_id: null,
                teacher_id: null,
              });
            }
          } else {
            setProfile(null);
          }
        });

        unsub = () => sub?.data?.subscription?.unsubscribe?.();
      } catch (e) {
        console.error('Критическая ошибка инициализации:', e);
        setSession(null);
        setProfile(null);
      } finally {
        // 5) Всегда завершаем загрузку
        setLoading(false);
        setInitializing(false);
      }
    };

    boot();

    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
    // Важно: если конфиг появится/исчезнет — переинициализируем
  }, [isSupabaseConfigured]);

  const loadProfile = async (userId) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase не сконфигурирован');
    }

    // Пытаемся получить профиль из public.users
    const { data, error } = await supabase
      .from('users')
      .select('id, role, display_name, student_id, teacher_id')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
      return;
    }

    // Нет записи — создаём временный профиль + пробуем вставить
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw new Error('Не удалось получить данные пользователя');
    }

    const tempProfile = {
      id: userId,
      role: 'student',
      display_name: userData.user?.email?.split('@')[0] || 'Пользователь',
      student_id: null,
      teacher_id: null,
    };

    setProfile(tempProfile);

    try {
      await supabase.from('users').insert([tempProfile]);
    } catch (insertError) {
      console.error('Не удалось создать профиль в базе:', insertError);
    }
  };

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
    () => ({ session, profile, loading, initializing, isSupabaseConfigured, signOut }),
    [session, profile, loading, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
