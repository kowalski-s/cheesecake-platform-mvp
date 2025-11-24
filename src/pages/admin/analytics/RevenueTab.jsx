import { useEffect, useState } from "react";
import { getRevenueStats, getRevenueChartData } from "../../../api/adminAnalytics";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "@/lib/safeToast";

export default function RevenueTab({ periodRange }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, chartDataResult] = await Promise.all([
          getRevenueStats(periodRange),
          getRevenueChartData(periodRange),
        ]);

        setStats(statsData);
        setChartData(chartDataResult);
      } catch (e) {
        console.error("Failed to load revenue stats", e);
        toast.error("Не удалось загрузить статистику по выручке");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange]);

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Выручка за период</h3>
          <div className="text-2xl font-semibold text-gray-900">
            {stats?.revenue ? `${stats.revenue.toLocaleString("ru-RU")} ₽` : "—"}
          </div>
          <p className="text-xs text-gray-500 mt-1">Поле price в subscriptions пока не используется</p>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Оформлено абонементов</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.newSubscriptionsCount || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Средний чек</h3>
          <div className="text-2xl font-semibold text-gray-900">
            {stats?.averageCheck ? `${stats.averageCheck.toLocaleString("ru-RU")} ₽` : "—"}
          </div>
        </div>
      </div>

      {/* График выручки */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Выручка по периодам</h3>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет данных для отображения</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  try {
                    return format(new Date(value), "dd.MM", { locale: ru });
                  } catch {
                    return value;
                  }
                }}
              />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#FF8A1F" strokeWidth={2} name="Абонементов" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

