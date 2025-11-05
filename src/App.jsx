import { useState, useEffect, useRef } from "react";
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
import Logout from "./pages/Auth/Logout";
import HomePage from "./pages/Home";
import DashboardStudent from "./pages/DashboardStudent";
import StudentsPage from "./pages/Students";
import DashboardTeacher from "./pages/DashboardTeacher";
import SchedulePage from "./pages/Schedule";
import MaterialsPage from "./pages/Materials";
import AdminPage from "./pages/Admin";
import TeacherProfile from "./pages/TeacherProfile";
import AdminProfile from "./pages/AdminProfile";
import TeachersPage from "./pages/Teachers";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import Loading from "./components/ui/Loading";
import AppLayout from "./layouts/AppLayout";
import UserMenu from "./components/UserMenu";

function App() {
  const { profile, initializing } = useAuth();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isAuthPage = ["/login", "/register", "/forgot", "/logout"].includes(
    location.pathname
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAuthPage && (
        <Topbar onToggleSidebar={() => setMobileSidebarOpen((v) => !v)} />
      )}

      <main>
        {isAuthPage ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/logout" element={<Logout />} />
          </Routes>
        ) : (
          <AppLayout
            mobileSidebarOpen={mobileSidebarOpen}
            onCloseSidebar={() => setMobileSidebarOpen(false)}
          >
            {initializing ? (
              <div className="flex justify-center items-center py-20">
                <Loading />
              </div>
            ) : (
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route
                  path="/teacher"
                  element={
                    <ProtectedRoute>
                      <RoleGuard allow={["teacher", "admin"]}>
                        <TeacherProfile />
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
                  path="/admin-profile"
                  element={
                    <ProtectedRoute>
                      <RoleGuard allow={["admin"]}>
                        <AdminProfile />
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
                      <RoleGuard allow={["student", "admin"]}>
                        <StudentsPage />
                      </RoleGuard>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </AppLayout>
        )}
      </main>

      {!isAuthPage && <Footer />}
    </div>
  );
}

function Topbar({ onToggleSidebar }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200/60 dark:bg-slate-900/70 dark:border-slate-800/60">
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        {/* Left: logo + brand */}
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold">🟠</div>
          <span className="font-semibold">Cheesecake School</span>
        </div>

        {/* Center: navigation removed; sidebar handles navigation */}

        {/* Right: user menu or login + mobile toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100"
            onClick={onToggleSidebar}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {user ? (
            <UserMenu />
          ) : (
            <NavLink to="/login" className="rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100">Войти</NavLink>
          )}
        </div>
      </div>

      {/* Mobile menu removed; off-canvas sidebar is handled by AppLayout */}
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
