import { useEffect, useState } from "react";
import { getAdminOverviewStats, getActiveSubscriptions } from "../../../api/adminAnalytics";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "@/lib/safeToast";

export default function OverviewTab({ periodRange }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [revenueChartData, setRevenueChartData] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, subsData] = await Promise.all([
          getAdminOverviewStats(periodRange),
          getActiveSubscriptions({ limit: 10 }),
        ]);

        setStats(statsData);
        setActiveSubscriptions(subsData.items || []);

        // Простой график выручки (пока по количеству абонементов)
        // Группируем по дням
        const dayMap = {};
        subsData.items?.forEach((sub) => {
          const dateKey = new Date(sub.created_at).toISOString().split("T")[0];
          if (!dayMap[dateKey]) {
            dayMap[dateKey] = { date: dateKey, count: 0 };
          }
          dayMap[dateKey].count++;
        });
        const chartData = Object.values(dayMap)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((day) => ({
            date: format(new Date(day.date), "dd.MM", { locale: ru }),
            count: day.count,
          }));
        setRevenueChartData(chartData);
      } catch (e) {
        console.error("Failed to load overview stats", e);
        toast.error("Не удалось загрузить статистику");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Карточки метрик */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Ученики</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.studentsCount || 0}</div>
          <p className="text-xs text-gray-500 mt-1">за период</p>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Абонементы</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.activeSubscriptionsCount || 0}</div>
          <p className="text-xs text-gray-500 mt-1">активных на сегодня</p>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Уроки</h3>
          <div className="text-2xl font-semibold text-gray-900">
            {stats?.doneLessons || 0} / {stats?.totalLessons || 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">проведено за период</p>
          {stats?.attendancePercent !== undefined && (
            <div className="mt-2">
              <div className="text-xs text-gray-600">Посещаемость: {stats.attendancePercent}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-brand h-2 rounded-full"
                  style={{ width: `${stats.attendancePercent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Выручка</h3>
          <div className="text-2xl font-semibold text-gray-900">
            {stats?.newSubscriptionsCount || 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">новых абонементов за период</p>
        </div>
      </div>

      {/* Активные абонементы */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Активные абонементы</h3>
        {activeSubscriptions.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет активных абонементов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Ученик</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Преподаватель</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">План</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Осталось</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">До окончания</th>
                </tr>
              </thead>
              <tbody>
                {activeSubscriptions.map((sub) => {
                  const student = sub.students;
                  const teacher = student?.teachers;
                  const daysLeft = sub.end_at
                    ? Math.ceil((new Date(sub.end_at) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm">{student?.display_name || "—"}</td>
                      <td className="py-2 px-3 text-sm">{teacher?.display_name || "—"}</td>
                      <td className="py-2 px-3 text-sm">{sub.name || "—"}</td>
                      <td className="py-2 px-3 text-sm">{sub.remaining_lessons || 0}</td>
                      <td className="py-2 px-3 text-sm">
                        {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} дн.` : "Истёк") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* График выручки */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Выручка по периодам</h3>
        {revenueChartData.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет данных для отображения</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#FF8A1F" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

