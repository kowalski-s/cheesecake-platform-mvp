import { useEffect, useState, useMemo } from "react";
import { getSubscriptionsStats, getSubscriptionsList, getAvailableClassNames } from "../../../api/adminAnalytics";
import PageHeader from "../../../components/ui/PageHeader";
import PeriodFilter from "../../../components/analytics/PeriodFilter";
import { calculatePeriodRange, formatPeriodDescription } from "../../../utils/periodUtils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "@/lib/safeToast";

export default function AdminAnalyticsSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Фильтры
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [baseDate, setBaseDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClassName, setSelectedClassName] = useState("");

  const periodRange = useMemo(() => {
    return calculatePeriodRange(selectedPeriod, baseDate, customFrom, customTo);
  }, [selectedPeriod, baseDate, customFrom, customTo]);

  const periodDescription = useMemo(() => {
    return formatPeriodDescription(selectedPeriod, customFrom, customTo);
  }, [selectedPeriod, customFrom, customTo]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, listData, classes] = await Promise.all([
          getSubscriptionsStats(periodRange),
          getSubscriptionsList({
            status: statusFilter,
            limit: itemsPerPage,
            offset: (currentPage - 1) * itemsPerPage,
            ...periodRange,
          }),
          getAvailableClassNames(),
        ]);

        setStats(statsData);
        setSubscriptions(listData.items || []);
        setTotal(listData.total || 0);
        setAvailableClasses(classes);
      } catch (e) {
        console.error("Failed to load subscriptions", e);
        toast.error("Не удалось загрузить данные об абонементах");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange, statusFilter, currentPage]);

  const totalPages = Math.ceil(total / itemsPerPage);

  // График выручки по дням
  const revenueChartData = useMemo(() => {
    const dayMap = {};
    subscriptions.forEach((sub) => {
      const dateKey = new Date(sub.created_at).toISOString().split("T")[0];
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = { date: dateKey, count: 0, revenue: 0 };
      }
      dayMap[dateKey].count++;
      // TODO: добавить revenue когда будет поле price
    });
    return Object.values(dayMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: format(new Date(day.date), "dd.MM", { locale: ru }),
        count: day.count,
        revenue: day.revenue,
      }));
  }, [subscriptions]);

  return (
    <div className="space-y-6">
      <PageHeader title="Абонементы и выручка" description={periodDescription} />

      <PeriodFilter
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
      />

      {/* Карточки метрик */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Активные абонементы</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.active || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Новые за период</h3>
          <div className="text-2xl font-semibold text-gray-900">
            {subscriptions.filter((s) => {
              const created = new Date(s.created_at);
              const from = periodRange.from ? new Date(periodRange.from) : null;
              const to = periodRange.to ? new Date(periodRange.to) : null;
              if (from && created < from) return false;
              if (to && created > to) return false;
              return true;
            }).length || 0}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Завершённые за период</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.completed || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Выручка за период</h3>
          <div className="text-2xl font-semibold text-gray-900">0 ₽</div>
          <p className="text-xs text-gray-400 mt-1">TODO: добавить поле price в subscriptions</p>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Статус абонемента</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="completed">Завершённые</option>
              <option value="expiring">Скоро заканчиваются</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Уровень ученика</label>
            <select
              value={selectedClassName}
              onChange={(e) => {
                setSelectedClassName(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Все уровни</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* График выручки */}
      {revenueChartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Выручка по дням</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#FF8A1F" strokeWidth={2} name="Абонементов" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Таблица */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Абонементы</h3>
        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : subscriptions.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет абонементов</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Ученик</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Преподаватель</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">План</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Уроки</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Статус</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Начало</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Окончание</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => {
                    const student = sub.students;
                    const teacher = student?.teachers;

                    return (
                      <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">{student?.display_name || "—"}</td>
                        <td className="py-2 px-3 text-sm">{teacher?.display_name || "—"}</td>
                        <td className="py-2 px-3 text-sm">{sub.name || "—"}</td>
                        <td className="py-2 px-3 text-sm">
                          {sub.lessons_total - (sub.remaining_lessons || 0)} / {sub.lessons_total || 0}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              sub.active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {sub.active ? "Активный" : "Завершён"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {sub.created_at ? new Date(sub.created_at).toLocaleDateString("ru-RU") : "—"}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {sub.end_at ? new Date(sub.end_at).toLocaleDateString("ru-RU") : "—"}
                        </td>
                        <td className="py-2 px-3 text-sm">—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Показано {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, total)} из {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

