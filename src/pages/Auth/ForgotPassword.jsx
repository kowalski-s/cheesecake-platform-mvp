import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="container max-w-md py-12">
      <div className="card">
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
  )
}