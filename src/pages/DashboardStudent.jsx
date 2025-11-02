import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'
import PageHeader from '../components/ui/PageHeader'
import Section from '../components/ui/Section'

export default function DashboardStudent() {
  const [subscription, setSubscription] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [past, setPast] = useState([])
  const [progress, setProgress] = useState([])
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return

      try {
        // Получаем данные ученика, включая teacher_id
        const { data: studentData } = await supabase
          .from('students')
          .select('id, teacher_id, remaining_lessons')
          .eq('id', user.id)
          .maybeSingle()
        
        // Если у ученика есть преподаватель, получаем его данные
        let teacherData = null
        if (studentData?.teacher_id) {
          const { data: teacher } = await supabase
            .from('teachers')
            .select('id, display_name, bio')
            .eq('id', studentData.teacher_id)
            .maybeSingle()
          teacherData = teacher
        }
        
        // Получаем остальные данные
        const [{ data: subs }, { data: lessons }, { data: prog }] = await Promise.all([
          supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('active', true).maybeSingle(),
          supabase.from('lessons').select('id, title, start_at, status, teacher:teachers(display_name)').eq('student_id', user.id).order('start_at', { ascending: true }),
          supabase.from('progress').select('*').eq('student_id', user.id).order('updated_at', { ascending: false }),
        ])

        setSubscription(subs || null)
        setTeacher(teacherData)
        
        const now = Date.now()
        setUpcoming((lessons || []).filter(l => new Date(l.start_at).getTime() >= now))
        setPast((lessons || []).filter(l => new Date(l.start_at).getTime() < now))
        setProgress(prog || [])
      } catch (error) {
        console.error('Error loading student data:', error)
      }
      
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
        <PageHeader 
          title="Личный кабинет" 
          description="Добро пожаловать в Cheesecake School!"
        />
        
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
      <PageHeader 
        title="Личный кабинет" 
        description="Ваш прогресс и расписание занятий"
      />
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Section className="h-full">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Активный абонемент</div>
              <div className="mt-1 text-xl font-semibold">{subscription ? subscription.name : 'Нет'}</div>
            </div>
            <div className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">Осталось: {remaining}</div>
          </div>
          {remaining === 1 && (
            <div className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Осталось одно занятие в абонементе</span>
              </div>
            </div>
          )}
        </Section>

        <Section className="h-full">
          <div className="text-sm text-gray-500">Следующее занятие</div>
          <div className="mt-1 text-xl font-semibold">
            {upcoming[0] ? (
              <span>
                {format(new Date(upcoming[0].start_at), 'dd.MM.yyyy HH:mm')} — {upcoming[0].title}
              </span>
            ) : 'Нет запланированных'}
          </div>
        </Section>

        <Section className="h-full">
          <div className="text-sm text-gray-500">Прогресс</div>
          <div className="mt-1 text-xl font-semibold">{progress.length} обновлений</div>
          <div className="mt-2">
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand" 
                style={{ width: `${Math.min(100, (past.length / (past.length + upcoming.length || 1)) * 100)}%` }}
              ></div>
            </div>
            <div className="mt-1 text-xs text-gray-500 flex justify-between">
              <span>Пройдено: {past.length}</span>
              <span>Всего: {past.length + upcoming.length}</span>
            </div>
          </div>
        </Section>
      </div>
      
      {/* Блок с преподавателем */}
      {teacher && (
        <Section 
          title="Мой преподаватель"
          className="bg-gradient-to-br from-orange-50 to-white"
        >
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold">
                {teacher.display_name?.charAt(0).toUpperCase() || '?'}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium">{teacher.display_name}</h3>
              <p className="text-sm text-gray-600 mt-1">{teacher.bio || 'Преподаватель китайского языка'}</p>
              <div className="mt-3 flex gap-2">
                <button className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Написать
                </button>
                <button className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Позвонить
                </button>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Блок с домашними заданиями */}
      <Section 
        title="Домашние задания"
        action={
          <button className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-medium bg-brand text-white hover:bg-brand-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Добавить ДЗ
          </button>
        }
      >
        <div className="text-center py-8 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>У вас пока нет домашних заданий</p>
          <button className="mt-3 text-sm text-brand hover:text-brand-muted">Загрузить файл</button>
        </div>
      </Section>

      <Section title="Предстоящие уроки">
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
          {upcoming.length === 0 && (
            <li className="py-8 text-center">
              <div className="text-gray-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">Нет предстоящих уроков</p>
              <button className="mt-3 text-sm text-brand hover:text-brand-muted">Записаться на занятие</button>
            </li>
          )}
        </ul>
      </Section>

      <Section title="Прошедшие уроки">
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
          {past.length === 0 && (
            <li className="py-8 text-center text-gray-500">
              <p>Нет прошедших уроков</p>
            </li>
          )}
        </ul>
      </Section>
    </div>
  )
}