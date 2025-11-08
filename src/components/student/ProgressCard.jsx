// Props: done (number), total (number), percent (number), emptyText (string)
export default function ProgressCard({ done = 0, total = 0, percent = 0, emptyText = 'Прогресс появится после первых уроков' }) {
  const safeTotal = Math.max(1, Number(total) || 0)
  const safeDone = Math.max(0, Number(done) || 0)
  const pct = Math.round((Number(percent) || (safeDone * 100) / safeTotal))
  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Прогресс</h2>
      {total > 0 ? (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Выполнено занятий</span>
            <span className="font-semibold">{safeDone}/{total}</span>
          </div>
          <div className="mt-2">
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }}></div>
            </div>
            <div className="mt-1 text-xs text-gray-500 flex justify-between">
              <span>Пройдено: {safeDone}</span>
              <span>Всего: {total}</span>
              <span className="font-semibold">{pct}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{emptyText}</span>
          <span className="font-semibold">0%</span>
        </div>
      )}
    </section>
  )
}