import { useEffect, useState } from "react";
import { getTeachersStats } from "../../../api/adminAnalytics";
import toast from "@/lib/safeToast";

export default function TeachersTab({ periodRange }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [workloadFilter, setWorkloadFilter] = useState("all");
  const [sortBy, setSortBy] = useState("lessons"); // 'name' | 'lessons'
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' | 'desc'

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await getTeachersStats(periodRange);
        setData(result);
      } catch (e) {
        console.error("Failed to load teachers stats", e);
        toast.error("Не удалось загрузить статистику по преподавателям");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodRange]);

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>;
  }

  if (!data) {
    return <div className="text-gray-500">Нет данных</div>;
  }

  // Фильтрация и сортировка
  let teachers = [...(data.teachers || [])];

  if (workloadFilter !== "all") {
    teachers = teachers.filter((t) => t.workload === workloadFilter);
  }

  teachers.sort((a, b) => {
    if (sortBy === "name") {
      return sortOrder === "asc"
        ? (a.display_name || "").localeCompare(b.display_name || "")
        : (b.display_name || "").localeCompare(a.display_name || "");
    } else {
      return sortOrder === "asc" ? a.lessonsCount - b.lessonsCount : b.lessonsCount - a.lessonsCount;
    }
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
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
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Нагрузка:</label>
          <select
            value={workloadFilter}
            onChange={(e) => setWorkloadFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">Все</option>
            <option value="низкая">Низкая</option>
            <option value="средняя">Средняя</option>
            <option value="высокая">Высокая</option>
          </select>
        </div>
      </div>

      {/* Таблица */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Преподаватели</h3>
        {teachers.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет преподавателей</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th
                    className="text-left py-2 px-3 text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("name")}
                  >
                    Преподаватель {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Ученики</th>
                  <th
                    className="text-left py-2 px-3 text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("lessons")}
                  >
                    Занятий {sortBy === "lessons" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Часов</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Нагрузка</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm">{teacher.display_name || "—"}</td>
                    <td className="py-2 px-3 text-sm">{teacher.studentsCount || 0}</td>
                    <td className="py-2 px-3 text-sm">{teacher.lessonsCount || 0}</td>
                    <td className="py-2 px-3 text-sm">{teacher.hoursCount || 0}</td>
                    <td className="py-2 px-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          teacher.workload === "высокая"
                            ? "bg-red-100 text-red-800"
                            : teacher.workload === "средняя"
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

