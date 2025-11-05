import { useAuth } from "../context/AuthContext";

export default function AdminProfile() {
  const { session, profile } = useAuth();
  const email = session?.user?.email || "";
  const role = profile?.role || "";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Профиль администратора</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 bg-gray-50" type="text" value={email} readOnly />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Роль</label>
          <input className="w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 bg-gray-50" type="text" value={role} readOnly />
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 p-6 text-gray-600">
        Скоро тут будут настройки профиля.
      </div>
    </div>
  );
}