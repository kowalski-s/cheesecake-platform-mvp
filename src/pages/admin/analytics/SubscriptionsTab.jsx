import { useEffect, useState } from "react";
import { getSubscriptionsStats, getSubscriptionsList } from "../../../api/adminAnalytics";
import toast from "@/lib/safeToast";

export default function SubscriptionsTab({ periodRange }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, listData] = await Promise.all([
          getSubscriptionsStats(periodRange),
          getSubscriptionsList({
            status: statusFilter,
            limit: itemsPerPage,
            offset: (currentPage - 1) * itemsPerPage,
            ...periodRange,
          }),
        ]);

        setStats(statsData);
        setSubscriptions(listData.items || []);
        setTotal(listData.total || 0);
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

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Всего абонементов</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.total || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Активные</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.active || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Скоро заканчиваются</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.expiringSoon || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Без абонемента</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.studentsWithoutSubs || 0}</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Статус:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="completed">Завершённые</option>
            <option value="expiring">Скоро заканчиваются</option>
          </select>
        </div>
      </div>

      {/* Таблица */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Абонементы</h3>
        {subscriptions.length === 0 ? (
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
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Статус</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Начало</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Окончание</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Всего</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Осталось</th>
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
                        <td className="py-2 px-3 text-sm">{sub.lessons_total || 0}</td>
                        <td className="py-2 px-3 text-sm">{sub.remaining_lessons || 0}</td>
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

