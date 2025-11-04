import { useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import DashboardStudent from "./pages/DashboardStudent";
import StudentsPage from "./pages/Students";
import DashboardTeacher from "./pages/DashboardTeacher";
import SchedulePage from "./pages/Schedule";
import MaterialsPage from "./pages/Materials";
import AdminPage from "./pages/Admin";
import TeachersPage from "./pages/Teachers";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import Loading from "./components/ui/Loading";

function App() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const isAuthPage = ["/login", "/register", "/forgot"].includes(
    location.pathname
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAuthPage && <Topbar />}

      <main className={isAuthPage ? "" : "max-w-6xl mx-auto px-4 py-6"}>
        {loading ? (
          <div className="flex justify-center items-center h-screen">
            <Loading />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<ForgotPassword />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  {profile?.role === "teacher" ? (
                    <Navigate to="/teacher" replace />
                  ) : (
                    <DashboardStudent />
                  )}
                </ProtectedRoute>
              }
            />

            <Route
              path="/teacher"
              element={
                <ProtectedRoute>
                  <RoleGuard allow={["teacher", "admin"]}>
                    <DashboardTeacher />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/schedule"
              element={
                <ProtectedRoute>
                  <SchedulePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/materials"
              element={
                <ProtectedRoute>
                  <MaterialsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleGuard allow={["admin"]}>
                    <AdminPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/teachers"
              element={
                <ProtectedRoute>
                  <TeachersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student"
              element={
                <ProtectedRoute>
                  <RoleGuard allow={["student"]}>
                    <StudentsPage />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
          </Routes>
        )}
      </main>

      {!isAuthPage && <Footer />}
    </div>
  );
}

function Topbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-10 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold">
            🟠
          </div>
          <span className="font-semibold">Cheesecake School</span>
        </div>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <NavLink
            className={({ isActive }) =>
              `text-sm ${
                isActive
                  ? "text-brand font-medium"
                  : "text-gray-600 hover:text-gray-900"
              }`
            }
            to="/dashboard"
          >
            Главная
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `text-sm ${
                isActive
                  ? "text-brand font-medium"
                  : "text-gray-600 hover:text-gray-900"
              }`
            }
            to="/schedule"
          >
            Расписание
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `text-sm ${
                isActive
                  ? "text-brand font-medium"
                  : "text-gray-600 hover:text-gray-900"
              }`
            }
            to="/materials"
          >
            Материалы
          </NavLink>
          {profile?.role === "admin" && (
            <NavLink
              className={({ isActive }) =>
                `text-sm ${
                  isActive
                    ? "text-brand font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`
              }
              to="/admin"
            >
              Админ
            </NavLink>
          )}
          {profile && (
            <button
              className="ml-2 inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-medium bg-brand text-white hover:bg-brand-muted transition-colors"
              onClick={handleSignOut}
            >
              Выйти
            </button>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-2 space-y-1">
            <NavLink
              className={({ isActive }) =>
                `block py-2 px-3 rounded-lg ${
                  isActive ? "bg-brand/10 text-brand font-medium" : "text-gray-600 hover:bg-gray-50"
                }`
              }
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
            >
              Главная
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `block py-2 px-3 rounded-lg ${
                  isActive ? "bg-brand/10 text-brand font-medium" : "text-gray-600 hover:bg-gray-50"
                }`
              }
              to="/schedule"
              onClick={() => setMobileMenuOpen(false)}
            >
              Расписание
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `block py-2 px-3 rounded-lg ${
                  isActive ? "bg-brand/10 text-brand font-medium" : "text-gray-600 hover:bg-gray-50"
                }`
              }
              to="/materials"
              onClick={() => setMobileMenuOpen(false)}
            >
              Материалы
            </NavLink>
            {profile?.role === "admin" && (
              <NavLink
                className={({ isActive }) =>
                  `block py-2 px-3 rounded-lg ${
                    isActive ? "bg-brand/10 text-brand font-medium" : "text-gray-600 hover:bg-gray-50"
                  }`
                }
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
              >
                Админ
              </NavLink>
            )}
            {profile && (
              <button
                className="w-full text-left block py-2 px-3 rounded-lg text-red-600 hover:bg-red-50"
                onClick={handleSignOut}
              >
                Выйти
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-4 text-sm text-gray-500">
        © {new Date().getFullYear()} Cheesecake School — MVP
      </div>
    </footer>
  );
}

export default App;
