import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "./ui/Loading";

// TODO: пометки, что Topbar рендерится всегда для авторизованных; 403/401 заглушки
export default function ProtectedRoute({ children, role = null }) {
  const { initializing, user, role: ctxRole } = useAuth();
  const location = useLocation();
  const [initDeadlinePassed, setInitDeadlinePassed] = useState(false);

  useEffect(() => {
    setInitDeadlinePassed(false);
    if (initializing) {
      const t = setTimeout(() => setInitDeadlinePassed(true), 5000);
      return () => clearTimeout(t);
    }
  }, [initializing]);

  // Если не авторизованы — сразу на /login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Пока идёт инициализация — до 5с показываем Loading; после — пропускаем контент
  if (initializing === true && !initDeadlinePassed) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loading />
      </div>
    );
  }

  // После тайм-аута или завершения инициализации — пропускаем контент

  // Если требуется роль — проверяем
  const normalizedRole = ctxRole?.trim()?.toLowerCase() ?? null;
  if (role && normalizedRole && normalizedRole !== role) {
    return (
      <Navigate
        to="/"
        replace
        state={{ toast: { type: 'error', message: 'Нет доступа' } }}
      />
    );
  }

  // Авторизованы — пропускаем контент
  return <>{children}</>;
}
