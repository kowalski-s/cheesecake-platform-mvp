import { useEffect, useState } from "react";
import { getLessonsStats, getAttendanceChartData, getAvailableClassNames } from "../../../api/adminAnalytics";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "@/lib/safeToast";

export default function LessonsTab({ periodRange }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClassName, setSelectedClassName] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, chartDataResult, classes] = await Promise.all([
          getLessonsStats({
            status: statusFilter,
            className: selectedClassName || null,
            ...periodRange,
          }),
          getAttendanceChartData({
            ...periodRange,
            className: selectedClassName || null,
          }),
          getAvailableClassNames(),
        ]);

        setStats(statsData);
        setChartData(chartDataResult);
        setAvailableClasses(classes);
      } catch (e) {
        console.error("Failed to load lessons stats", e);
        toast.error("Не удалось загрузить статистику по занятиям");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange, statusFilter, selectedClassName]);

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Занятий в период</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.total || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Проведено</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.done || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Отменено</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.canceled || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Посещаемость</h3>
          <div className="text-2xl font-semibold text-gray-900">{stats?.attendancePercent || 0}%</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Статус:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">Все</option>
            <option value="planned">Запланировано</option>
            <option value="done">Проведено</option>
            <option value="canceled">Отменено</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Уровень / класс:</label>
          <select
            value={selectedClassName}
            onChange={(e) => setSelectedClassName(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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

      {/* График посещаемости */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Посещаемость по дням</h3>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет данных для отображения</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
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
              <Bar dataKey="done" fill="#10B981" name="Проведено" />
              <Bar dataKey="canceled" fill="#EF4444" name="Отменено" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

