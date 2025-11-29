import { formatDateOnlyYYYYMMDD, parseDateOnlyYYYYMMDD } from "../../lib/datetime";

export default function PeriodFilter({
  selectedPeriod,
  onPeriodChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
}) {
  return (
    <div className="card p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Период</label>
        <div className="flex flex-wrap gap-2">
          {["week", "month", "all", "custom"].map((period) => (
            <button
              key={period}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? "bg-brand text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => onPeriodChange(period)}
            >
              {period === "week"
                ? "Неделя"
                : period === "month"
                ? "Месяц"
                : period === "all"
                ? "Всё время"
                : "Свой период"}
            </button>
          ))}
        </div>

        {/* Кастомный диапазон дат */}
        {selectedPeriod === "custom" && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Дата от</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={customFrom ? formatDateOnlyYYYYMMDD(customFrom) : ""}
                onChange={(e) => {
                  const d = parseDateOnlyYYYYMMDD(e.target.value);
                  if (d) onCustomFromChange(d);
                }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Дата до</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={customTo ? formatDateOnlyYYYYMMDD(customTo) : ""}
                onChange={(e) => {
                  const d = parseDateOnlyYYYYMMDD(e.target.value);
                  if (d) onCustomToChange(d);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


