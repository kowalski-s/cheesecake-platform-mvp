import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { getMyTeacherId } from "../lib/api";

export default function AppLayout({ children, mobileSidebarOpen = false, onCloseSidebar = () => {} }) {
  const { role: ctxRole, profile } = useAuth();
  const role = (ctxRole ?? profile?.role)?.trim()?.toLowerCase() ?? null;
  const firstLinkRef = useRef(null);
  const closeButtonRef = useRef(null);
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('info');
  const [pendingCount, setPendingCount] = useState(0);

  // Manage focus and close on Escape when off-canvas open
  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const focusTimer = setTimeout(() => {
      try {
        (closeButtonRef.current || firstLinkRef.current)?.focus();
      } catch {}
    }, 0);

    const onKeyDown = (e) => {
      if (e.key === "Escape") onCloseSidebar();
    };
    document.addEventListener("keydown", onKeyDown);

    // Simple focus trap inside the off-canvas panel
    const trapKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trapKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", trapKeyDown);
    };
  }, [mobileSidebarOpen, onCloseSidebar]);

  // Read toast from navigation state and show it globally
  useEffect(() => {
    const toast = location.state?.toast;
    if (toast) {
      setToastType(toast.type || 'info');
      setToastMsg(String(toast.message || ''));
      // Clear state so toast doesn't reappear on back/forward
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Auto hide toast
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Pending homeworks counter for teachers
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const isTeacher = ["teacher", "admin"].includes((role || "").trim().toLowerCase());
        if (!isTeacher) return;
        const tid = await getMyTeacherId(supabase);
        if (!tid) return;
        const { count } = await supabase
          .from('v_teacher_pending_submissions')
          .select('*', { count: 'exact', head: true });
        if (alive) setPendingCount(count ?? 0);
      } catch {}
    };
    load();
    const h = (e) => {
      const delta = (e?.detail?.countDelta ?? 0);
      if (delta !== 0) setPendingCount(prev => Math.max(0, prev + delta));
    };
    window.addEventListener('pendingHomeworksUpdated', h);
    return () => { alive = false; window.removeEventListener('pendingHomeworksUpdated', h); };
  }, [role]);

  const SidebarContent = (
    <aside className="w-60 shrink-0 border-r border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-900 md:flex md:flex-col md:min-h-screen md:overflow-y-auto" aria-label="Сайдбар">
      <div className="flex flex-col h-full">
        {/* Main links */}
        <nav className="flex-1 flex flex-col gap-1 pt-3 pb-2 px-3">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition ${isActive ? "bg-gray-100 text-brand font-medium" : "text-gray-600 hover:text-gray-800"}`
            }
            tabIndex={0}
            ref={firstLinkRef}
          >
            Главная
          </NavLink>
          <NavLink
            to="/schedule"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition ${isActive ? "bg-gray-100 text-brand font-medium" : "text-gray-600 hover:text-gray-800"}`
            }
            aria-current={({ isActive }) => (isActive ? "page" : undefined)}
          >
            Расписание
          </NavLink>
          {(["teacher", "admin"].includes((role || "").trim().toLowerCase())) && (
            <NavLink
              to="/teacher/homeworks"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 transition flex items-center justify-between ${isActive ? "bg-gray-100 text-brand font-medium" : "text-gray-600 hover:text-gray-800"}`
              }
              aria-current={({ isActive }) => (isActive ? "page" : undefined)}
            >
              <span>Проверка ДЗ</span>
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-2 py-0.5">{pendingCount}</span>
              )}
            </NavLink>
          )}
          <NavLink
            to="/materials"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition ${isActive ? "bg-gray-100 text-brand font-medium" : "text-gray-600 hover:text-gray-800"}`
            }
            tabIndex={0}
          >
            Материалы
          </NavLink>
        </nav>

        {/* Admin link at bottom (only for admin) */}
        {role === "admin" && (
          <div className="p-3">
            <div className="my-2 h-px bg-slate-200/60 dark:bg-slate-800/60" />
            <NavLink
              to="/admin"
              aria-label="Админ-панель"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 transition ${isActive ? "bg-gray-100 text-brand font-medium" : "text-gray-600 hover:text-gray-800"}`
              }
              aria-current={({ isActive }) => (isActive ? "page" : undefined)}
            >
              Админ-панель
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{SidebarContent}</div>

      {/* Mobile off-canvas sidebar */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          ref={overlayRef}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onCloseSidebar} />
      <div className="absolute left-0 top-0 bottom-0 shadow-lg">
        <div
          className="h-full"
          onClick={(e) => e.stopPropagation()}
          ref={panelRef}
        >
          {/* Off-canvas header with close button (mobile only) */}
          <div className="md:hidden flex items-center justify-end p-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900">
            <button
              type="button"
              aria-label="Закрыть сайдбар"
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand"
              onClick={onCloseSidebar}
              tabIndex={0}
              ref={closeButtonRef}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {SidebarContent}
        </div>
      </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </div>

      {/* Global toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow ${toastType === 'error' ? 'bg-red-600 text-white' : toastType === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>{toastMsg}</div>
      )}
    </div>
  );
}