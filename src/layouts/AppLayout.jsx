import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppLayout({ children, mobileSidebarOpen = false, onCloseSidebar = () => {} }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const firstLinkRef = useRef(null);
  const closeButtonRef = useRef(null);
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

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
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 transition ${isActive ? "bg-gray-100 text-brand font-medium" : "text-gray-600 hover:text-gray-800"}`
              }
              aria-current={({ isActive }) => (isActive ? "page" : undefined)}
            >
              Админ
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
    </div>
  );
}