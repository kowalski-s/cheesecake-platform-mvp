import { useEffect, useState, useMemo } from "react";
import { getAdminStudentsAnalytics, getAvailableClassNames } from "../../../api/adminAnalytics";
import PageHeader from "../../../components/ui/PageHeader";
import PeriodFilter from "../../../components/analytics/PeriodFilter";
import { calculatePeriodRange, formatPeriodDescription } from "../../../utils/periodUtils";
import toast from "@/lib/safeToast";

export default function AdminAnalyticsStudentsPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Фильтры
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [baseDate, setBaseDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [selectedClassName, setSelectedClassName] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("all");

  const periodRange = useMemo(() => {
    return calculatePeriodRange(selectedPeriod, baseDate, customFrom, customTo);
  }, [selectedPeriod, baseDate, customFrom, customTo]);

  const periodDescription = useMemo(() => {
    return formatPeriodDescription(selectedPeriod, customFrom, customTo, selectedClassName || null);
  }, [selectedPeriod, customFrom, customTo, selectedClassName]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [studentsData, classes] = await Promise.all([
          getAdminStudentsAnalytics({
            ...periodRange,
            className: selectedClassName || null,
            subscriptionStatus,
            limit: itemsPerPage,
            offset: (currentPage - 1) * itemsPerPage,
          }),
          getAvailableClassNames(),
        ]);

        setStudents(studentsData.items || []);
        setTotal(studentsData.total || 0);
        setAvailableClasses(classes);
      } catch (e) {
        console.error("Failed to load students analytics", e);
        toast.error("Не удалось загрузить данные по ученикам");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange, selectedClassName, subscriptionStatus, currentPage]);

  const totalPages = Math.ceil(total / itemsPerPage);

  // Топ-10 по риску
  const atRiskStudents = useMemo(() => {
    return students
      .filter((s) => s.attendancePercent < 70 || s.homeworkPercent < 60)
      .slice(0, 10);
  }, [students]);

  return (
    <div className="space-y-6">
      <PageHeader title="Ученики" description={periodDescription} />

      <PeriodFilter
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
      />

      {/* Фильтры */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Класс / уровень</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Статус абонемента</label>
            <select
              value={subscriptionStatus}
              onChange={(e) => {
                setSubscriptionStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">Все</option>
              <option value="with">С абонементом</option>
              <option value="without">Без абонемента</option>
              <option value="expiring">Скоро заканчивается</option>
            </select>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ученики за период</h3>
        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : students.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет учеников</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Имя ученика</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Email</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Уровень</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Преподаватель</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Уроки</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Посещаемость</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Средняя оценка</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">ДЗ выполнено</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Статус абонемента</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm">{student.display_name || "—"}</td>
                      <td className="py-2 px-3 text-sm">{student.email || "—"}</td>
                      <td className="py-2 px-3 text-sm">{student.className || "—"}</td>
                      <td className="py-2 px-3 text-sm">{student.teacher?.display_name || "—"}</td>
                      <td className="py-2 px-3 text-sm">
                        {student.doneLessons || 0} / {student.totalLessons || 0}
                      </td>
                      <td className="py-2 px-3 text-sm">{student.attendancePercent || 0}%</td>
                      <td className="py-2 px-3 text-sm">{student.averageGrade !== null ? student.averageGrade : "—"}</td>
                      <td className="py-2 px-3 text-sm">{student.homeworkPercent || 0}%</td>
                      <td className="py-2 px-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            student.subscriptionStatus === "активен"
                              ? "bg-green-100 text-green-800"
                              : student.subscriptionStatus === "скоро заканчивается"
                              ? "bg-yellow-100 text-yellow-800"
                              : student.subscriptionStatus === "завершён"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {student.subscriptionStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
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

      {/* Топ-10 по риску */}
      {atRiskStudents.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Топ-10 по риску</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Имя</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Уровень</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Преподаватель</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Посещаемость</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">ДЗ выполнено</th>
                </tr>
              </thead>
              <tbody>
                {atRiskStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm">{student.display_name || "—"}</td>
                    <td className="py-2 px-3 text-sm">{student.className || "—"}</td>
                    <td className="py-2 px-3 text-sm">{student.teacher?.display_name || "—"}</td>
                    <td className="py-2 px-3 text-sm">{student.attendancePercent || 0}%</td>
                    <td className="py-2 px-3 text-sm">{student.homeworkPercent || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

