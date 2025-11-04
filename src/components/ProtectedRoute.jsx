import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "./ui/Loading";

// TODO: пометки, что Topbar рендерится всегда для авторизованных; 403/401 заглушки
export default function ProtectedRoute({ children }) {
  const { session, isSupabaseConfigured } = useAuth();
  const location = useLocation();

  // Если не авторизованы — сразу на /login
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Если Supabase не настроен — показываем понятный экран (но не блокируем редирект выше)
  if (!isSupabaseConfigured) {
    return (
      <div className="card p-8 text-center">
        <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-yellow-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Supabase не настроен</h2>
        <p className="text-gray-600">Проверь переменные окружения.</p>
      </div>
    );
  }

  // Авторизованы — пропускаем контент
  return <>{children}</>;
}
