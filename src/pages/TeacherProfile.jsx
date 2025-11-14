import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import Loading from "../components/ui/Loading";
import Section from "../components/ui/Section";
import toast from "@/lib/safeToast";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getTeacherAnalytics } from "@/api/teacherAnalytics";

export default function TeacherProfile() {
  const { session, role, user } = useAuth();
  const userId = user?.id || session?.user?.id || null;
  const [form, setForm] = useState({ display_name: "", bio: "", specialization: "" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const initials = (() => {
    const e = email || session?.user?.email || "";
    return (e.split("@")[0]?.[0] || "?").toUpperCase();
  })();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      if (!isSupabaseConfigured || !supabase || !userId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error: fetchError } = await supabase
          .from("teachers")
          .select("id, user_id, display_name, bio, specialization")
          .eq("user_id", userId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        setForm({
          display_name: data?.display_name || "",
          bio: data?.bio || "",
          specialization: data?.specialization || "",
        });
        setTeacherId(data?.id || null);
        const uid = data?.user_id || userId
        if (uid) {
          const { data: uRow, error: uErr } = await supabase
            .from('v_users_full')
            .select('id, email')
            .eq('id', uid)
            .maybeSingle()
          if (uErr) throw uErr
          setEmail(uRow?.email || "")
        } else {
          setEmail("")
        }
      } catch (e) {
        console.error(e);
        setError(e?.message || "Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
  };
  load();
}, [userId]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    if (!isSupabaseConfigured || !supabase || !userId) {
      setSaving(false);
      return;
    }
    try {
      const { error: updateError } = await supabase
        .from("teachers")
        .update({
          display_name: form.display_name,
          bio: form.bio,
          specialization: form.specialization,
        })
        .eq("user_id", userId);
      if (updateError) throw updateError;
    } catch (e) {
      console.error(e);
      setError(e?.message || "Не удалось сохранить изменения");
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-500">role: {role} uid: {user?.id}</div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Профиль преподавателя</h1>
          <p className="text-gray-500">Редактирование отображаемых данных</p>
          <div className="mt-1 text-sm text-gray-600">Email: {email || '—'}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center">Загрузка…</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Имя</label>
            <input
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              type="text"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Специализация</label>
            <input
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              type="text"
              value={form.specialization}
              onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">О себе</label>
            <textarea
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              rows={4}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-xl bg-brand py-2.5 px-4 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
            <button
              className="rounded-xl border border-gray-300 py-2.5 px-4 text-center font-medium"
              onClick={() => window.location.reload()}
              disabled={saving}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* ДЗ удалены из профиля — остаются только личные данные */}

      {/* Аналитика преподавателя */}
      <TeacherAnalyticsSection teacherId={teacherId} />
    </div>
  );
}

// График оценок преподавателя с одноразовой анимацией на сессию
function TeacherGradesTimelineChart({ data, domainMax }) {
  useEffect(() => {
    if (!window.__teacherAnalyticsAnimatedOnce) {
      // Устанавливаем флаг, но не триггерим перерендер, чтобы анимация не прерывалась
      window.__teacherAnalyticsAnimatedOnce = true;
    }
  }, []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd.MM')} />
        <YAxis domain={[0, domainMax]} tickCount={6} />
        <Tooltip
          formatter={(value, name, props) => [value, `${props?.payload?.title || '—'} — ${props?.payload?.student || '—'}`]}
          labelFormatter={(label) => format(new Date(label), 'dd.MM.yyyy HH:mm')}
        />
        <Line
          type="monotone"
          dataKey="grade"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={false}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          isAnimationActive={!window.__teacherAnalyticsAnimatedOnce}
          animationDuration={1800}
          animationEasing="ease-in-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TeacherAnalyticsSection({ teacherId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    async function loadAnalytics() {
      try {
        setLoading(true)
        setError(null)
        if (!teacherId) {
          setData(null)
          return
        }
        const a = await getTeacherAnalytics(teacherId)
        if (mounted) setData(a)
      } catch (e) {
        console.error('ERR_LOAD_TEACHER_ANALYTICS', e, e?.stack)
        setError(e)
        if (toast && typeof toast.error === 'function') {
          toast.error('Не удалось загрузить аналитику')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadAnalytics()
    return () => { mounted = false }
  }, [teacherId])

  const totalLessons = data?.totalLessons ?? 0
  const completedLessons = data?.completedLessons ?? 0
  const progressPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0
  const totalAssignmentsGiven = data?.totalAssignmentsGiven ?? 0
  const checkedAssignments = data?.checkedAssignments ?? 0
  const avgGrade = data?.averageGrade
  const lastActivityAt = data?.lastActivityAt

  return (
    <Section>
      <h2 className="text-lg font-semibold mb-3">Аналитика преподавателя</h2>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
          <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
          <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
          <div className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Уроки */}
          <div className="card p-4">
            <div className="text-sm text-gray-500 mb-1">Уроки</div>
            <div className="font-semibold">Проведено {completedLessons} из {totalLessons}</div>
            <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden" aria-label="Прогресс расписания">
              <div className="h-full bg-brand" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{progressPercent}% расписания</div>
          </div>

          {/* Домашние задания */}
          <div className="card p-4">
            <div className="text-sm text-gray-500 mb-1">Домашние задания</div>
            <div className="font-semibold">Проверено {checkedAssignments} из {totalAssignmentsGiven}</div>
            <div className="text-xs text-gray-500 mt-1">Проверенные ДЗ</div>
          </div>

          {/* Средняя оценка */}
          <div className="card p-4">
            <div className="text-sm text-gray-500 mb-1">Средняя оценка</div>
            <div className="font-semibold">{avgGrade != null ? avgGrade : '—'}</div>
            {(Array.isArray(data?.gradesTimeline) && data.gradesTimeline.some(r => Number(r?.grade) > 10)) ? (
              <div className="text-xs text-gray-500 mt-1">из 100</div>
            ) : null}
          </div>

          {/* Последняя активность */}
          <div className="card p-4">
            <div className="text-sm text-gray-500 mb-1">Последняя активность</div>
            <div className="font-semibold">{lastActivityAt ? format(new Date(lastActivityAt), 'dd.MM.yyyy HH:mm') : '—'}</div>
          </div>
        </div>
      )}

      {/* График оценок */}
      <div className="mt-4">
        {loading ? (
          <div className="card p-4">
            <div className="h-72 bg-gray-100 animate-pulse rounded"></div>
          </div>
        ) : (Array.isArray(data?.gradesTimeline) && data.gradesTimeline.length > 0 ? (
          <div className="card p-4">
            <div style={{ width: '100%', height: 280 }}>
              <TeacherGradesTimelineChart
                data={data.gradesTimeline}
                domainMax={(Array.isArray(data?.gradesTimeline) && data.gradesTimeline.some(r => Number(r?.grade) > 10)) ? 100 : 10}
              />
            </div>
          </div>
        ) : (
          <div className="card p-4">
            <div className="text-sm text-gray-500">Пока нет данных</div>
          </div>
        ))}
      </div>
    </Section>
  )
}