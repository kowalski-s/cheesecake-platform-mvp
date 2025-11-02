import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    if (!isSupabaseConfigured || !supabase) {
      setError('Нет подключения к базе, проверьте переменные окружения')
      setLoading(false)
      return
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
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
          <h2 className="text-2xl font-semibold text-center">Восстановление пароля</h2>
          
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Письмо отправлено!</span>
                </div>
                <p>Проверьте вашу почту. Мы отправили инструкции по восстановлению пароля на указанный email.</p>
              </div>
              
              <div className="text-center">
                <Link 
                  to="/login" 
                  className="inline-block rounded-xl bg-brand py-2.5 px-4 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
                >
                  Вернуться к входу
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
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
              
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              
              <button 
                className="w-full rounded-xl bg-brand py-2.5 px-4 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
                disabled={loading}
              >
                {loading ? 'Отправляем...' : 'Отправить инструкции'}
              </button>
              
              <div className="text-center text-sm text-gray-600">
                <Link to="/login" className="font-medium text-brand hover:text-brand-muted">
                  Вернуться к входу
                </Link>
              </div>
            </form>
          )}
          
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