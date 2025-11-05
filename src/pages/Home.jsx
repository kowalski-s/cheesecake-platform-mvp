import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { profile, session, user, role, initializing } = useAuth();
  const displayName = profile?.display_name || session?.user?.email || "";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Главная</h1>
      <p className="mt-2 text-gray-600">Добро пожаловать{displayName ? `, ${displayName}` : ""}!</p>
      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-10 text-xs text-gray-400">
          dev: user.id={user?.id ?? 'null'}, role={role ?? 'null'}, initializing={String(initializing)}
        </div>
      )}
    </div>
  );
}