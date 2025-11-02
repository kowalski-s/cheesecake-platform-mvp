import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!isSupabaseConfigured || !supabase) {
      setError('Нет подключения к базе, проверьте переменные окружения')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand" />
          <div className="text-lg font-semibold">Cheesecake School</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-6">
        <h1 className="mb-6 text-2xl font-semibold">Восстановление пароля</h1>
        {sent ? (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Письмо с инструкциями отправлено. Проверьте почту.
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm text-gray-600">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <button className="btn-primary w-full">Отправить</button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}