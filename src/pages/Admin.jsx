// src/pages/Admin.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/ui/PageHeader";
import Section from "../components/ui/Section";
import Loading from "../components/ui/Loading";
import InviteUserModal from "../components/InviteUserModal";

// TODO: вкладки Ученики/Преподаватели/Материалы, модалки добавления, фильтр "заканчивается абонемент"
export default function AdminPage() {
  const navigate = useNavigate();
  const { profile, role, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filterEnding, setFilterEnding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Модалка приглашения пользователя
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDefaultRole, setInviteDefaultRole] = useState("teacher");
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState("success");

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    role: "student",
    teacher_id: "",
    remaining_lessons: 0,
    bio: "",
    description: "",
    storage_path: "",
  });

  useEffect(() => {
    // Раньше была внутренняя проверка роли и редирект.
    // Теперь доступ контролируется через RoleGuard на уровне маршрута.
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  // авто-скрытие toast
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  async function loadData() {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Supabase не настроен. Данные недоступны.");
      setLoading(false);
      return;
    }

    try {
      const [
        { data: studs, error: studsError },
        { data: ts, error: tsError },
        { data: mats, error: matsError },
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id, display_name, teacher_id, remaining_lessons, teacher:teachers(display_name)")
          .order("display_name"),
        supabase.from("teachers").select("id, display_name, bio").order("display_name"),
        supabase
          .from("materials")
          .select("id, title, description, storage_path, owner_id, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (studsError) throw studsError;
      if (tsError) throw tsError;
      if (matsError) throw matsError;

      setStudents(studs || []);
      setTeachers(ts || []);
      setMaterials(mats || []);
    } catch (e) {
      console.error(e);
      setError("Ошибка при загрузке данных. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    try {
      if (activeTab === "students") {
        await supabase.from("students").insert({
          display_name: formData.display_name,
          teacher_id: formData.teacher_id || null,
          remaining_lessons: Number(formData.remaining_lessons) || 0,
        });
      } else if (activeTab === "teachers") {
        await supabase.from("teachers").insert({
          display_name: formData.display_name,
          bio: formData.bio || null,
        });
      } else if (activeTab === "materials") {
        await supabase.from("materials").insert({
          title: formData.display_name,
          description: formData.description || null,
          storage_path: formData.storage_path || "public/example.pdf",
        });
      }

      setShowAddModal(false);
      setFormData({
        display_name: "",
        email: "",
        role: "student",
        teacher_id: "",
        remaining_lessons: 0,
        bio: "",
        description: "",
        storage_path: "",
      });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  }

  const filteredStudents = filterEnding
    ? students.filter((s) => (s.remaining_lessons ?? 0) <= 1)
    : students;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Админ-панель"
        description="Управление учениками, преподавателями и материалами"
      />

      {/* Dev-баннер роли для отладки */}
      <div className="text-xs text-gray-400">role: {(role ?? profile?.role)?.trim()?.toLowerCase() ?? 'unknown'}</div>

      {/* основное содержимое */}
      {!authLoading && (
        <>
          {/* табы */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6">
              {[
                { id: "students", label: "Ученики" },
                { id: "teachers", label: "Преподаватели" },
                { id: "materials", label: "Материалы" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === tab.id
                      ? "border-orange-400 text-orange-500"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {error && (
            <div className="card p-6 text-center">
              <p className="mb-4 text-gray-700">{error}</p>
              <button
                onClick={loadData}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white"
              >
                Повторить
              </button>
            </div>
          )}

          {!error && loading && <Loading />}

          {!error && !loading && (
            <>
              {/* TAB: ученики */}
              {activeTab === "students" && (
                <Section
                  title="Список учеников"
                  action={
                    <div className="flex gap-4 items-center">
                      <label className="flex gap-2 text-sm items-center">
                        <input
                          type="checkbox"
                          checked={filterEnding}
                          onChange={(e) => setFilterEnding(e.target.checked)}
                        />
                        <span>Заканчивается абонемент</span>
                      </label>
                      <button
                        onClick={() => {
                          setInviteDefaultRole("student");
                          setInviteOpen(true);
                        }}
                        className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white"
                      >
                        Добавить ученика
                      </button>
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Имя
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Преподаватель
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Осталось
                          </th>
                          <th className="px-6 py-3" />
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudents.map((student) => (
                          <tr key={student.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">
                                {student.display_name}
                              </div>
                              <div className="text-xs text-gray-400">
                                {student.id}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {student.teacher?.display_name || "Не назначен"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                                  (student.remaining_lessons ?? 0) <= 1
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {student.remaining_lessons ?? 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-sm text-orange-500">
                              Редактировать
                            </td>
                          </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-6 py-10 text-center text-gray-400"
                            >
                              Нет учеников
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* TAB: преподы */}
              {activeTab === "teachers" && (
                <Section
                  title="Преподаватели"
                  action={
                    <button
                      onClick={() => {
                        setInviteDefaultRole("teacher");
                        setInviteOpen(true);
                      }}
                      className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white"
                    >
                      Добавить преподавателя
                    </button>
                  }
                >
                  {/* Форма приглашения перенесена в InviteUserModal */}

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Имя
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Описание
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {teachers.map((t) => (
                          <tr key={t.id}>
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {t.display_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {t.id}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {t.bio || "—"}
                            </td>
                          </tr>
                        ))}
                        {teachers.length === 0 && (
                          <tr>
                            <td
                              colSpan="3"
                              className="px-6 py-6 text-center text-gray-400"
                            >
                              Нет преподавателей
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* TAB: материалы */}
              {activeTab === "materials" && (
                <Section
                  title="Материалы"
                  action={
                    <button
                      onClick={() => {
                        setFormData({
                          display_name: "",
                          description: "",
                          storage_path: "",
                        });
                        setShowAddModal(true);
                      }}
                      className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white"
                    >
                      Добавить материал
                    </button>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Название
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Описание
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Путь
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {materials.map((m) => (
                          <tr key={m.id}>
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {m.title || "Без названия"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {m.description || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {m.storage_path}
                            </td>
                          </tr>
                        ))}
                        {materials.length === 0 && (
                          <tr>
                            <td
                              colSpan="3"
                              className="px-6 py-6 text-center text-gray-400"
                            >
                              Нет материалов
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}
            </>
          )}

          {/* МОДАЛКА — ВНУТРИ КОРНЕВОГО DIV */}
          {showAddModal && activeTab === "materials" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>

                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    {activeTab === "students" && "Добавить ученика"}
                    {activeTab === "teachers" && "Добавить преподавателя"}
                    {activeTab === "materials" && "Добавить материал"}
                  </h3>

                  <form className="space-y-4" onSubmit={handleAddItem}>
                    {/* общее поле */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {activeTab === "materials" ? "Название" : "Имя"}
                      </label>
                      <input
                        type="text"
                        value={formData.display_name}
                        onChange={(e) =>
                          setFormData({ ...formData, display_name: e.target.value })
                        }
                        className="w-full border rounded-xl px-3 py-2"
                        required
                      />
                    </div>

                    {/* специфичные поля */}
                    {activeTab === "students" && (
                      <>
                        <div>
                          <label className="block text-sm mb-1">
                            Преподаватель
                          </label>
                          <select
                            value={formData.teacher_id}
                            onChange={(e) =>
                              setFormData({ ...formData, teacher_id: e.target.value })
                            }
                            className="w-full border rounded-xl px-3 py-2"
                          >
                            <option value="">Не выбран</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.display_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm mb-1">
                            Осталось уроков
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.remaining_lessons}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                remaining_lessons: e.target.value,
                              })
                            }
                            className="w-full border rounded-xl px-3 py-2"
                          />
                        </div>
                      </>
                    )}

                    {activeTab === "teachers" && (
                      <div>
                        <label className="block text-sm mb-1">Описание</label>
                        <textarea
                          rows="3"
                          value={formData.bio}
                          onChange={(e) =>
                            setFormData({ ...formData, bio: e.target.value })
                          }
                          className="w-full border rounded-xl px-3 py-2"
                        />
                      </div>
                    )}

                    {activeTab === "materials" && (
                      <>
                        <div>
                          <label className="block text-sm mb-1">Описание</label>
                          <textarea
                            rows="3"
                            value={formData.description}
                            onChange={(e) =>
                              setFormData({ ...formData, description: e.target.value })
                            }
                            className="w-full border rounded-xl px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Путь к файлу</label>
                          <input
                            type="text"
                            value={formData.storage_path}
                            onChange={(e) =>
                              setFormData({ ...formData, storage_path: e.target.value })
                            }
                            className="w-full border rounded-xl px-3 py-2"
                            placeholder="public/example.pdf"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-4 py-2 rounded-xl border"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-orange-500 text-white"
                      >
                        Сохранить
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          {/* InviteUserModal */}
          <InviteUserModal
            isOpen={inviteOpen}
            onClose={() => setInviteOpen(false)}
            defaultRole={inviteDefaultRole}
            onSuccess={async () => {
              setInviteOpen(false);
              setToastType("success");
              setToastMsg("Приглашение отправлено");
              await loadData();
            }}
          />
          {/* Toast */}
          {toastMsg && (
            <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toastType === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
              {toastMsg}
            </div>
          )}
        </>
      )}
    </div>
  );
}
