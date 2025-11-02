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
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-brand/10 mb-4">
            <div className="h-10 w-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold">🟠</div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Cheesecake School</h1>
          <p className="text-sm text-gray-500 mt-1">платформа для учеников</p>
        </div>
        
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-8 space-y-6">
          <h2 className="text-2xl font-semibold text-center">Создание аккаунта</h2>
          
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Имя</label>
              <input 
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input 
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
              <input 
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            
            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            
            <button 
              className="w-full rounded-xl bg-brand py-2.5 px-4 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
              disabled={loading}
            >
              {loading ? 'Создаём...' : 'Зарегистрироваться'}
            </button>
          </form>
          
          <div className="mt-4 text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="font-medium text-brand hover:text-brand-muted">
              Войти
            </Link>
          </div>
          
          {!isSupabaseConfigured && (
            <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
              Нет подключения к базе, проверьте переменные окружения.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}