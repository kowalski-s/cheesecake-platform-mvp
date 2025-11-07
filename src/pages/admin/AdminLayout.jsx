import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminLayout() {
  const [seeding, setSeeding] = useState(false)
  const [toast, setToast] = useState(null)

  const runSeed = async () => {
    try {
      setSeeding(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/.netlify/functions/seed-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setToast({ type: 'success', msg: 'Демо-данные добавлены' })
      } else {
        const txt = await res.text().catch(() => '')
        setToast({ type: 'error', msg: txt || 'Ошибка сидера' })
      }
    } catch (e) {
      setToast({ type: 'error', msg: 'Ошибка запуска сидера' })
    } finally {
      setSeeding(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Админ-панель</h1>
          <p className="text-gray-600 text-sm">Управление разделами платформы</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            onClick={runSeed}
            disabled={seeding}
          >
            {seeding ? 'Заполняю…' : 'Заполнить демо-данными'}
          </button>
        </div>
      </header>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <NavLink
            to="students"
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`
            }
            end
          >
            Ученики
          </NavLink>
          <NavLink
            to="teachers"
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`
            }
            end
          >
            Преподаватели
          </NavLink>
          <NavLink
            to="materials"
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`
            }
            end
          >
            Материалы
          </NavLink>
          <NavLink
            to="users"
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`
            }
            end
          >
            Пользователи
          </NavLink>
          <NavLink
            to="lessons"
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`
            }
            end
          >
            Занятия
          </NavLink>
        </nav>
      </div>

      <Outlet />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
    </div>
  );
}