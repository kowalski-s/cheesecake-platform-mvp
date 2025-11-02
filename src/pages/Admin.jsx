import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/ui/PageHeader'
import Section from '../components/ui/Section'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('students')
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [materials, setMaterials] = useState([])
  const [filterEnding, setFilterEnding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    role: 'student',
    teacher_id: '',
    remaining_lessons: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data: studs }, { data: ts }, { data: mats }] = await Promise.all([
        supabase.from('students').select('id, display_name, teacher_id, remaining_lessons, teacher:teachers(display_name)').order('display_name'),
        supabase.from('teachers').select('id, display_name, bio').order('display_name'),
        supabase.from('materials').select('id, title, description, storage_path, owner_id, created_at').order('created_at', { ascending: false }),
      ])
      setStudents(studs || [])
      setTeachers(ts || [])
      setMaterials(mats || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    
    try {
      if (activeTab === 'students') {
        // В реальном приложении здесь был бы вызов supabase.auth.admin.createUser
        // Но для MVP просто добавляем запись в таблицу students
        await supabase.from('students').insert({
          display_name: formData.display_name,
          teacher_id: formData.teacher_id || null,
          remaining_lessons: parseInt(formData.remaining_lessons) || 0
        })
      } else if (activeTab === 'teachers') {
        // В реальном приложении здесь был бы вызов supabase.auth.admin.createUser
        // Но для MVP просто добавляем запись в таблицу teachers
        await supabase.from('teachers').insert({
          display_name: formData.display_name,
          bio: formData.bio || null
        })
      } else if (activeTab === 'materials') {
        await supabase.from('materials').insert({
          title: formData.display_name,
          description: formData.description || null,
          storage_path: formData.storage_path || 'public/example.pdf'
        })
      }
      
      setShowAddModal(false)
      setFormData({
        display_name: '',
        email: '',
        role: 'student',
        teacher_id: '',
        remaining_lessons: 0,
        bio: '',
        description: '',
        storage_path: ''
      })
      await loadData()
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  const filteredStudents = filterEnding ? students.filter(s => (s.remaining_lessons ?? 0) <= 1) : students

  // Для приглашения пользователей через Supabase Auth Admin API
  // Примечание: это требует серверной функции или Edge Function в Supabase
  // В реальном приложении это должно быть реализовано на сервере
  const inviteUserComment = `
  // Пример кода для приглашения пользователя через supabase.auth.admin.inviteUserByEmail
  // Этот код должен выполняться на сервере (например, в Supabase Edge Function)
  
  // 1. Создайте Edge Function в Supabase
  // supabase functions new invite-user
  
  // 2. Реализуйте функцию примерно так:
  // export async function inviteUser(email, role) {
  //   const adminAuthClient = supabase.auth.admin
  //   const { data, error } = await adminAuthClient.inviteUserByEmail(email, {
  //     redirectTo: 'https://your-app.netlify.app/login',
  //     data: { role }
  //   })
  //   
  //   if (error) throw error
  //   
  //   // Создать запись в соответствующей таблице
  //   if (role === 'teacher') {
  //     await supabase.from('teachers').insert({ id: data.user.id, display_name: email.split('@')[0] })
  //   } else if (role === 'student') {
  //     await supabase.from('students').insert({ id: data.user.id, display_name: email.split('@')[0] })
  //   }
  //   
  //   return data
  // }
  
  // 3. Вызывайте эту функцию из клиента:
  // const { data, error } = await supabase.functions.invoke('invite-user', {
  //   body: { email, role }
  // })
  `

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Админ-панель" 
        description="Управление учениками, преподавателями и материалами"
      />
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('students')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'students'
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Ученики
          </button>
          <button
            onClick={() => setActiveTab('teachers')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'teachers'
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Преподаватели
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'materials'
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Материалы
          </button>
        </nav>
      </div>
      
      {/* Content */}
      <div className="mt-6">
        {activeTab === 'students' && (
          <Section
            title="Список учеников"
            action={
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={filterEnding} 
                    onChange={(e) => setFilterEnding(e.target.checked)}
                    className="rounded text-brand focus:ring-brand"
                  />
                  <span>Заканчивается абонемент</span>
                </label>
                <button
                  onClick={() => {
                    setFormData({
                      display_name: '',
                      email: '',
                      role: 'student',
                      teacher_id: '',
                      remaining_lessons: 0
                    })
                    setShowAddModal(true)
                  }}
                  className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-muted"
                >
                  Добавить ученика
                </button>
              </div>
            }
          >
            {loading ? (
              <div className="py-10 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Загрузка данных...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Имя</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Преподаватель</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Осталось занятий</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map(student => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{student.display_name}</div>
                          <div className="text-sm text-gray-500">{student.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.teacher?.display_name || 'Не назначен'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                            (student.remaining_lessons ?? 0) <= 1 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {student.remaining_lessons ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                          Нет учеников
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
        
        {activeTab === 'teachers' && (
          <Section
            title="Список преподавателей"
            action={
              <button
                onClick={() => {
                  setFormData({
                    display_name: '',
                    email: '',
                    role: 'teacher',
                    bio: ''
                  })
                  setShowAddModal(true)
                }}
                className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-muted"
              >
                Добавить преподавателя
              </button>
            }
          >
            {loading ? (
              <div className="py-10 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Загрузка данных...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Имя</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Информация</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teachers.map(teacher => (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {teacher.display_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {teacher.id}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {teacher.bio || 'Нет информации'}
                        </td>
                      </tr>
                    ))}
                    {teachers.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                          Нет преподавателей
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
        
        {activeTab === 'materials' && (
          <Section
            title="Учебные материалы"
            action={
              <button
                onClick={() => {
                  setFormData({
                    display_name: '',
                    description: '',
                    storage_path: ''
                  })
                  setShowAddModal(true)
                }}
                className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-muted"
              >
                Добавить материал
              </button>
            }
          >
            {loading ? (
              <div className="py-10 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Загрузка данных...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Описание</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Путь</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materials.map(material => (
                      <tr key={material.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {material.title || 'Без названия'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {material.description || 'Нет описания'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {material.storage_path}
                        </td>
                      </tr>
                    ))}
                    {materials.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                          Нет материалов
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
      </div>
      
      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddModal(false)}></div>
            
            <div className="relative transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                  onClick={() => setShowAddModal(false)}
                >
                  <span className="sr-only">Закрыть</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {activeTab === 'students' && 'Добавить ученика'}
                  {activeTab === 'teachers' && 'Добавить преподавателя'}
                  {activeTab === 'materials' && 'Добавить материал'}
                </h3>
                
                <form className="mt-4 space-y-4" onSubmit={handleAddItem}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {activeTab === 'materials' ? 'Название' : 'Имя'}
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      required
                    />
                  </div>
                  
                  {(activeTab === 'students' || activeTab === 'teachers') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        В MVP версии email не используется для приглашения
                      </p>
                    </div>
                  )}
                  
                  {activeTab === 'students' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Преподаватель
                        </label>
                        <select
                          value={formData.teacher_id}
                          onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                          className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        >
                          <option value="">Не выбран</option>
                          {teachers.map(teacher => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Осталось занятий
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.remaining_lessons}
                          onChange={(e) => setFormData({...formData, remaining_lessons: e.target.value})}
                          className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    </>
                  )}
                  
                  {activeTab === 'teachers' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Информация
                      </label>
                      <textarea
                        value={formData.bio || ''}
                        onChange={(e) => setFormData({...formData, bio: e.target.value})}
                        className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        rows="3"
                      ></textarea>
                    </div>
                  )}
                  
                  {activeTab === 'materials' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Описание
                        </label>
                        <textarea
                          value={formData.description || ''}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                          rows="3"
                        ></textarea>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Путь к файлу
                        </label>
                        <input
                          type="text"
                          value={formData.storage_path || ''}
                          onChange={(e) => setFormData({...formData, storage_path: e.target.value})}
                          className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                          placeholder="public/example.pdf"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          В MVP версии загрузка файлов не реализована
                        </p>
                      </div>
                    </>
                  )}
                  
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-xl border border-transparent bg-brand px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Добавить
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={() => setShowAddModal(false)}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}