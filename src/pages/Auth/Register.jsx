import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
      },
    })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    // Create application user profile with default role 'student'
    const userId = data.user?.id
    if (userId) {
      await supabase.from('users').insert({ id: userId, role: 'student', display_name: name })
    }
    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand" />
          <div className="text-lg font-semibold">Cheesecake School</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-6">
        <h1 className="mb-6 text-2xl font-semibold">Регистрация</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Имя</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
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
            {loading ? 'Создаём…' : 'Зарегистрироваться'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="hover:text-gray-900">Войти</Link>
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