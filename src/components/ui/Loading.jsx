export default function Loading({ message = 'Загрузка…' }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-6 py-8 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-full bg-brand/20" />
        <div className="text-sm text-gray-600">{message}</div>
      </div>
    </div>
  )
}