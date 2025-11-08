import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Section from "../components/ui/Section";
import Loading from "../components/ui/Loading";

export default function TeachersPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeachers() {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("teachers")
        .select("id, display_name, bio")
        .order("display_name");

      if (fetchError) throw fetchError;
      setTeachers(data || []);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }

  const exampleTeachers = [
    { id: "1", display_name: "Иванов Иван", bio: "Преподаватель математики с 10-летним опытом" },
    { id: "2", display_name: "Петрова Мария", bio: "Специалист по английскому языку" },
    { id: "3", display_name: "Сидоров Алексей", bio: "Физика и астрономия" },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Преподаватели" description="Все преподаватели школы" />
        <div className="card p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Не удалось загрузить данные</h2>
          <div className="text-sm text-red-600 mb-4">{error}</div>
          <div className="flex justify-center gap-4">
            <button
              onClick={loadTeachers}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white"
            >
              Повторить
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-xl border border-gray-300"
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Преподаватели" description="Все преподаватели школы" />

      {loading ? (
        <Loading />
      ) : (
        <Section title="Список преподавателей">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(isSupabaseConfigured ? teachers : exampleTeachers).map((teacher) => (
              <div
                key={teacher.id}
                className="rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-medium mb-2">{teacher.display_name}</h3>
                <p className="text-sm text-gray-600">{teacher.bio || "Нет информации"}</p>
                <div className="text-xs text-gray-400 mt-2">ID: {teacher.id}</div>
              </div>
            ))}
            {isSupabaseConfigured && teachers.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                Преподаватели не найдены
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
