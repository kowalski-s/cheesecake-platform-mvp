import { useEffect, useMemo, useState } from "react"
import { inviteUser } from "../lib/api"

export default function InviteUserModal({ isOpen, onClose, defaultRole = "teacher", onSuccess }) {
  const role = useMemo(() => String(defaultRole || "teacher").trim().toLowerCase(), [defaultRole])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setEmail("")
      setName("")
      setSubmitting(false)
      setError(null)
    }
  }, [isOpen])

  const isValidEmail = (v) => /.+@.+\..+/.test(String(v).trim())

  if (!isOpen) return null

  const title = role === "teacher" ? "Пригласить преподавателя" : "Пригласить ученика"

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) {
      setError("Введите корректный email")
      return
    }
    setSubmitting(true)
    try {
      const res = await inviteUser({ email, display_name: name, role })
      if (res.ok) {
        onClose?.()
        onSuccess?.(res.data?.user || null)
      } else {
        if (res.status === 400) setError("Введите корректный email")
        else if (res.status === 409) setError("Такой пользователь уже существует или уже приглашён")
        else setError("Не удалось отправить приглашение, попробуйте снова.")
      }
    } catch (e2) {
      setError("Ошибка при отправке приглашения")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Закрыть"
        >
          ✕
        </button>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <input
                type="text"
                placeholder="Имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Роль</label>
              <select className="w-full border rounded-xl px-3 py-2" value={role} disabled>
                <option value="teacher">teacher</option>
                <option value="student">student</option>
              </select>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="px-4 py-2 rounded-xl border text-gray-700" onClick={onClose}>
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-orange-500 text-white disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "Отправка..." : "Пригласить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}