import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      setError('Нет подключения к базе, проверьте переменные окружения')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      // After login, route by role
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (userId) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle()
        const role = data?.role
        if (role === 'admin') navigate('/admin')
        else if (role === 'teacher') navigate('/teacher')
        else navigate('/dashboard')
      } else {
        navigate('/dashboard')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand" />
          <div className="text-lg font-semibold">Cheesecake School</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-6">
        <h1 className="mb-6 text-2xl font-semibold">Вход</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
        <div className="mt-4 flex justify-between text-sm text-gray-600">
          <Link to="/register" className="hover:text-gray-900">Регистрация</Link>
          <Link to="/forgot" className="hover:text-gray-900">Забыли пароль?</Link>
        </div>
        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
            Нет подключения к базе, проверьте переменные окружения.
          </div>
        )}
        </div>
      </div>
    </div>
  )
}