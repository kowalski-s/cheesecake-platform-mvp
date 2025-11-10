import { formatDate } from '../../lib/formatDate'

export default function SubscriptionCard({ subscriptionEnd, lessonsLeft, active }) {
  const hasData = Boolean(subscriptionEnd) || (typeof lessonsLeft === 'number' && lessonsLeft >= 0) || typeof active === 'boolean'

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Абонемент</h2>

      {!hasData ? (
        <div className="text-sm text-gray-600">Нет активного абонемента</div>
      ) : (
        <div className="space-y-2">
          {typeof subscriptionEnd !== 'undefined' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Окончание</span>
              <span className="font-medium">
                {subscriptionEnd ? formatDate(subscriptionEnd) : '—'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Осталось занятий</span>
            <span className="font-medium">{typeof lessonsLeft === 'number' ? lessonsLeft : '—'}</span>
          </div>
          {typeof active === 'boolean' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Статус</span>
              <span className="font-medium">{active ? 'активен' : 'не активен'}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}