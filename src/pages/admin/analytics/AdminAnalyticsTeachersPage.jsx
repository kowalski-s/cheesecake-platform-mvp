import { useEffect, useState, useMemo } from "react";
import { getAdminTeachersAnalytics } from "../../../api/adminAnalytics";
import PageHeader from "../../../components/ui/PageHeader";
import PeriodFilter from "../../../components/analytics/PeriodFilter";
import { calculatePeriodRange, formatPeriodDescription } from "../../../utils/periodUtils";
import toast from "@/lib/safeToast";

export default function AdminAnalyticsTeachersPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [workloadFilter, setWorkloadFilter] = useState("all");
  const [hasStudents, setHasStudents] = useState("all");

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
        const result = await getAdminTeachersAnalytics({
          ...periodRange,
          workloadFilter,
          hasStudents,
        });
        setData(result);
      } catch (e) {
        console.error("Failed to load teachers analytics", e);
        toast.error("Не удалось загрузить статистику по преподавателям");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange, workloadFilter, hasStudents]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Преподаватели" description={periodDescription} />
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Преподаватели" description={periodDescription} />
        <div className="text-gray-500">Нет данных</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Преподаватели" description={periodDescription} />

      <PeriodFilter
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
      />

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Всего преподавателей</h3>
          <div className="text-2xl font-semibold text-gray-900">{data.totalTeachers || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">С учениками (за 30 дней)</h3>
          <div className="text-2xl font-semibold text-gray-900">{data.teachersWithStudents || 0}</div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Без учеников</h3>
          <div className="text-2xl font-semibold text-gray-900">{data.teachersWithoutStudents || 0}</div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Нагрузка</label>
            <select
              value={workloadFilter}
              onChange={(e) => setWorkloadFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">Все</option>
              <option value="low">Низкая</option>
              <option value="normal">Нормальная</option>
              <option value="high">Высокая</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Активность</label>
            <select
              value={hasStudents}
              onChange={(e) => setHasStudents(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">Все</option>
              <option value="with">Есть ученики</option>
              <option value="without">Без учеников</option>
            </select>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Нагрузка преподавателей</h3>
        {data.teachers.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет преподавателей</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Преподаватель</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Ученики</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Уроки</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Часов</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Средняя посещаемость</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Нагрузка</th>
                </tr>
              </thead>
              <tbody>
                {data.teachers.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm">{teacher.display_name || "—"}</td>
                    <td className="py-2 px-3 text-sm">{teacher.activeStudentsCount || 0}</td>
                    <td className="py-2 px-3 text-sm">
                      {teacher.doneLessons || 0} / {teacher.plannedLessons || 0} / {teacher.canceledLessons || 0}
                    </td>
                    <td className="py-2 px-3 text-sm">{teacher.hoursCount || 0}</td>
                    <td className="py-2 px-3 text-sm">{teacher.avgAttendance || 0}%</td>
                    <td className="py-2 px-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          teacher.workload === "высокая"
                            ? "bg-red-100 text-red-800"
                            : teacher.workload === "нормальная"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {teacher.workload || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

