import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import Loading from "../components/ui/Loading";

export default function TeacherProfile() {
  const { session, role, user } = useAuth();
  const userId = user?.id || session?.user?.id || null;
  const [form, setForm] = useState({ display_name: "", bio: "", specialization: "" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
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
    </div>
  );
}