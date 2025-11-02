import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

export default function DashboardStudent() {
  const [subscription, setSubscription] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [past, setPast] = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return

      const [{ data: subs }, { data: lessons }, { data: prog }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('active', true).maybeSingle(),
        supabase.from('lessons').select('id, title, start_at, status, teacher:teachers(display_name)').eq('student_id', user.id).order('start_at', { ascending: true }),
        supabase.from('progress').select('*').eq('student_id', user.id).order('updated_at', { ascending: false }),
      ])

      setSubscription(subs || null)
      const now = Date.now()
      setUpcoming((lessons || []).filter(l => new Date(l.start_at).getTime() >= now))
      setPast((lessons || []).filter(l => new Date(l.start_at).getTime() < now))
      setProgress(prog || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-pulse mb-4 mx-auto h-12 w-12 rounded-full bg-gray-200"></div>
        <p className="text-gray-600">Загрузка данных...</p>
      </div>
    )
  }

  // Если нет данных, показываем красивую заглушку вместо пустой страницы
  const hasNoData = !subscription && upcoming.length === 0 && past.length === 0 && progress.length === 0

  if (hasNoData) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center">
          <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Добро пожаловать в Cheesecake School!</h2>
          <p className="text-gray-600 mb-6">Похоже, у вас пока нет активных занятий или абонемента.</p>
          <div className="flex justify-center gap-4">
            <a href="/schedule" className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand-muted">
              Посмотреть расписание
            </a>
            <a href="/materials" className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50">
              Учебные материалы
            </a>
          </div>
        </div>
      </div>
    )
  }

  const remaining = subscription?.remaining_lessons ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Активный абонемент</div>
              <div className="mt-1 text-xl font-semibold">{subscription ? subscription.name : 'Нет'}</div>
            </div>
            <div className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">Осталось: {remaining}</div>
          </div>
          {remaining === 1 && (
            <div className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">Осталось одно занятие в абонементе</div>
          )}
        </div>

        <div className="card">
          <div className="text-sm text-gray-500">Следующее занятие</div>
          <div className="mt-1 text-xl font-semibold">
            {upcoming[0] ? (
              <span>
                {format(new Date(upcoming[0].start_at), 'dd.MM.yyyy HH:mm')} — {upcoming[0].title}
              </span>
            ) : 'Нет запланированных'}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-500">Прогресс</div>
          <div className="mt-1 text-xl font-semibold">{progress.length} обновлений</div>
        </div>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Предстоящие уроки</h2>
          <a href="/materials" className="btn-outline">Материалы</a>
        </div>
        <ul className="divide-y divide-gray-100">
          {upcoming.map(l => (
            <li key={l.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{l.title}</div>
                <div className="text-sm text-gray-500">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')} • {l.teacher?.display_name}</div>
              </div>
              <span className="rounded-xl bg-green-50 px-3 py-1 text-sm text-green-700">{l.status}</span>
            </li>
          ))}
          {upcoming.length === 0 && <li className="py-3 text-sm text-gray-500">Нет предстоящих уроков</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Прошедшие уроки</h2>
        <ul className="divide-y divide-gray-100">
          {past.map(l => (
            <li key={l.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{l.title}</div>
                <div className="text-sm text-gray-500">{format(new Date(l.start_at), 'dd.MM.yyyy HH:mm')} • {l.teacher?.display_name}</div>
              </div>
              <span className="rounded-xl bg-gray-50 px-3 py-1 text-sm text-gray-700">{l.status}</span>
            </li>
          ))}
          {past.length === 0 && <li className="py-3 text-sm text-gray-500">Нет прошедших уроков</li>}
        </ul>
      </section>
    </div>
  )
}