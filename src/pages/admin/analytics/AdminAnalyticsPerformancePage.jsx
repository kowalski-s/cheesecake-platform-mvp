import { useEffect, useState, useMemo } from "react";
import { getAdminPerformanceStats } from "../../../api/adminAnalytics";
import PageHeader from "../../../components/ui/PageHeader";
import PeriodFilter from "../../../components/analytics/PeriodFilter";
import { calculatePeriodRange, formatPeriodDescription } from "../../../utils/periodUtils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import toast from "@/lib/safeToast";

export default function AdminAnalyticsPerformancePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Фильтры периода
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [baseDate, setBaseDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);

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
        const data = await getAdminPerformanceStats(periodRange);
        setStats(data);
      } catch (e) {
        console.error("Failed to load performance stats", e);
        toast.error("Не удалось загрузить статистику по успеваемости");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange]);

  // Данные для графика распределения оценок
  const gradeChartData = useMemo(() => {
    if (!stats?.gradeDistribution) return [];
    return [
      { range: "0-59", count: stats.gradeDistribution["0-59"] || 0 },
      { range: "60-69", count: stats.gradeDistribution["60-69"] || 0 },
      { range: "70-79", count: stats.gradeDistribution["70-79"] || 0 },
      { range: "80-89", count: stats.gradeDistribution["80-89"] || 0 },
      { range: "90-100", count: stats.gradeDistribution["90-100"] || 0 },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      <PageHeader title="Успеваемость" description={periodDescription} />

      <PeriodFilter
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
      />

      {loading ? (
        <div className="text-gray-500">Загрузка...</div>
      ) : (
        <>
          {/* Карточки метрик */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Средняя оценка</h3>
              <div className="text-2xl font-semibold text-gray-900">
                {stats?.platformAverageGrade !== null ? stats.platformAverageGrade : "—"}
              </div>
              <p className="text-xs text-gray-500 mt-1">По платформе за период</p>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">ДЗ выполнено</h3>
              <div className="text-2xl font-semibold text-gray-900">{stats?.platformHomeworkPercent || 0}%</div>
              <p className="text-xs text-gray-500 mt-1">Общая доля выполненных ДЗ</p>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Ученики в зоне риска</h3>
              <div className="text-2xl font-semibold text-gray-900">{stats?.atRiskCount || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Оценка &lt; 70 или ДЗ &lt; 60%</p>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Высокий результат</h3>
              <div className="text-2xl font-semibold text-gray-900">{stats?.highPerformerCount || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Оценка ≥ 90 и ДЗ ≥ 90%</p>
            </div>
          </div>

          {/* График распределения оценок */}
          {gradeChartData.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Распределение оценок</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gradeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF8A1F" name="Количество учеников" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Таблица учеников в зоне риска */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ученики в зоне риска</h3>
            {!stats?.atRiskStudents || stats.atRiskStudents.length === 0 ? (
              <p className="text-gray-500 text-sm">Нет учеников в зоне риска</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Имя</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Email</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Уровень</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Преподаватель</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Средняя оценка</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">ДЗ выполнено</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Посещаемость</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.atRiskStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">{student.display_name || "—"}</td>
                        <td className="py-2 px-3 text-sm">{student.email || "—"}</td>
                        <td className="py-2 px-3 text-sm">{student.className || "—"}</td>
                        <td className="py-2 px-3 text-sm">{student.teacher?.display_name || "—"}</td>
                        <td className="py-2 px-3 text-sm">
                          {student.averageGrade !== null ? student.averageGrade : "—"}
                        </td>
                        <td className="py-2 px-3 text-sm">{student.homeworkPercent || 0}%</td>
                        <td className="py-2 px-3 text-sm">{student.attendancePercent || 0}%</td>
                        <td className="py-2 px-3 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {student.riskReasons?.map((reason, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-800"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

