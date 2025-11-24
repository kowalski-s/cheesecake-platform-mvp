import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import Loading from "../components/ui/Loading";
import Avatar from "../components/ui/Avatar";
import toast from "../lib/safeToast";

export default function TeacherProfile() {
  const { session, role, user } = useAuth();
  const userId = user?.id || session?.user?.id || null;
  const [form, setForm] = useState({ display_name: "", bio: "", specialization: "", avatar_url: null });
  const [email, setEmail] = useState("");
  const [teacherId, setTeacherId] = useState(null); // ID записи в teachers
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
          .select("id, user_id, display_name, bio, specialization, avatar_url")
          .eq("user_id", userId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (data) {
          setTeacherId(data.id); // Сохраняем ID записи для update
          setForm({
            display_name: data.display_name || "",
            bio: data.bio || "",
            specialization: data.specialization || "",
            avatar_url: data.avatar_url || null,
          });
        }
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
    if (!isSupabaseConfigured || !supabase || !userId || !teacherId) {
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
          avatar_url: form.avatar_url,
        })
        .eq("id", teacherId);
      if (updateError) throw updateError;
      toast.success("Профиль сохранён");
      // Перезагружаем данные профиля
      window.location.reload();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Не удалось сохранить изменения");
  } finally {
    setSaving(false);
  }
};

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      // Удаляем старое изображение если есть
      if (form.avatar_url) {
        try {
          await supabase.storage.from('avatars').remove([form.avatar_url]);
        } catch (err) {
          console.warn('Не удалось удалить старое изображение', err);
        }
      }

      // Загружаем новое изображение
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${userId}/${timestamp}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Обновляем форму
      setForm(prev => ({ ...prev, avatar_url: filePath }));
      
      // Сохраняем через update по ID записи (не по user_id)
      if (!teacherId) {
        throw new Error('ID преподавателя не найден');
      }
      
      const { error: updateError } = await supabase
        .from("teachers")
        .update({ avatar_url: filePath })
        .eq("id", teacherId);
      
      if (updateError) throw updateError;
      
      toast.success('Аватар обновлён');
      
      // Перезагружаем данные профиля
      window.location.reload();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Не удалось загрузить аватар');
    } finally {
      setUploadingAvatar(false);
      // Сбрасываем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  return (
    <div className="space-y-6">
      {/* Блок "Профиль преподавателя" */}
      <div className="card p-6">
        {loading ? (
          <div className="py-10 text-center text-gray-500">Загрузка…</div>
        ) : (
          <>
            {/* Header профиля */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    className="relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                    title="Нажмите, чтобы изменить аватар"
                  >
                    <Avatar 
                      displayName={form.display_name} 
                      email={email} 
                      size="md" 
                      avatarUrl={form.avatar_url}
                    />
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-6 w-6 text-white" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </button>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {form.display_name || 'Преподаватель'}
                  </h1>
                  <div className="mt-1 text-sm text-gray-600">{email || '—'}</div>
                  {form.specialization && (
                    <div className="mt-1 text-sm text-gray-500">{form.specialization}</div>
                  )}
                </div>
              </div>
              <button
                className="rounded-xl bg-brand py-2.5 px-6 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
                onClick={() => {
                  const formElement = document.getElementById('teacher-profile-form')
                  formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                Редактировать профиль
              </button>
            </div>

            {/* Форма редактирования */}
            <div id="teacher-profile-form" className="mt-6 space-y-4">
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Имя</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0 transition-colors"
                    type="text"
                    value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="Введите имя"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Специализация</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0 transition-colors"
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                    placeholder="Например: Китайский язык"
                  />
                </div>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">О себе</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0 transition-colors resize-none"
                  rows={6}
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Расскажите о себе, опыте и подходе к обучению..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  className="rounded-xl bg-brand py-2.5 px-6 text-center font-medium text-white hover:bg-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "Сохраняем..." : "Сохранить"}
                </button>
                <button
                  className="rounded-xl border border-gray-300 py-2.5 px-6 text-center font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => window.location.reload()}
                  disabled={saving}
                >
                  Отмена
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
