import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import toast from '@/lib/safeToast'
import { supabase } from "../../lib/supabaseClient";

export default function AdminLayout() {
  const [seeding, setSeeding] = useState(false)

  const runSeed = async () => {
    try {
      setSeeding(true)
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token || ''
      const res = await fetch('/.netlify/functions/seed-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({}),
      })

      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) {
        const msg = body?.message || body?.error || `Seed failed (${res.status})`
        throw new Error(msg)
      }

      const counts = body?.details?.counts
      const mk = (o) => o ? `created ${o.created ?? 0}, skipped ${o.skipped ?? 0}` : 'n/a'
      const msg = counts
        ? `Демо-данные созданы: users(${mk(counts?.users)}), teachers(${mk(counts?.teachers)}), students(${mk(counts?.students)}), lessons(${mk(counts?.lessons)})`
        : 'Демо-данные созданы'
      toast.success(msg)
    } catch (e) {
      const msg = e?.message || 'Ошибка при создании демо-данных'
      toast.error(msg)
    } finally {
      setSeeding(false)
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
          <NavLink
            to="analytics"
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 transition ${
                isActive
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`
            }
            end
          >
            Аналитика
          </NavLink>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}