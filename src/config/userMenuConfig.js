/**
 * Конфигурация пунктов меню пользователя по ролям
 * Используется в UserMenu компоненте
 */

/**
 * Получить конфигурацию пунктов меню для указанной роли
 * @param {string} role - роль пользователя ('student' | 'teacher' | 'admin')
 * @returns {Array} массив объектов с конфигурацией пунктов меню
 */
export function getUserMenuItems(role) {
  const normalizedRole = role?.trim()?.toLowerCase() ?? null

  // Базовые пункты, общие для всех ролей
  const baseItems = [
    {
      type: 'link',
      label: 'Профиль',
      path: getProfilePath(normalizedRole),
    },
  ]

  // Пункт "Статистика" только для student и teacher
  if (normalizedRole === 'student' || normalizedRole === 'teacher') {
    baseItems.push({
      type: 'link',
      label: 'Статистика',
      path: getStatisticsPath(normalizedRole),
    })
  }

  // Общие пункты для всех
  baseItems.push(
    {
      type: 'button',
      label: 'Настройки',
      onClick: () => {
        console.log('TODO: settings')
      },
    },
    {
      type: 'link',
      label: 'Выйти',
      path: '/logout',
      isLogout: true,
    }
  )

  return baseItems
}

/**
 * Получить путь к профилю в зависимости от роли
 * @param {string} normalizedRole - нормализованная роль
 * @returns {string} путь к профилю
 */
function getProfilePath(normalizedRole) {
  if (normalizedRole === 'student') return '/students/me'
  if (normalizedRole === 'teacher') return '/teacher/profile'
  if (normalizedRole === 'admin') return '/admin-profile'
  return '/'
}

/**
 * Получить путь к странице статистики в зависимости от роли
 * @param {string} normalizedRole - нормализованная роль
 * @returns {string} путь к статистике
 */
function getStatisticsPath(normalizedRole) {
  if (normalizedRole === 'student') return '/student/analytics'
  if (normalizedRole === 'teacher') return '/teacher/analytics'
  return null
}

