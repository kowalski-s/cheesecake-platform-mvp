import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Компонент аккордеона для навигации с подпунктами
 */
export default function AccordionNavItem({ label, to, children, icon }) {
  const location = useLocation();
  const pathname = location.pathname;
  
  // Определяем активность: путь должен начинаться с to
  const isActive = to && pathname.startsWith(to);
  
  // Автоматически открываем, если текущий путь начинается с to
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive]);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <button
        onClick={toggle}
        className={`w-full rounded-lg px-3 py-2 transition flex items-center justify-between ${
          isActive
            ? "bg-gray-100 text-brand font-medium"
            : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 flex-1">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{label}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Подпункты */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="pl-4 pt-1 space-y-1">
          {children.map((child) => {
            const isChildActive = location.pathname === child.to;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm transition ${
                    isActive || isChildActive
                      ? "bg-orange-50 text-orange-600 font-medium border-l-2 border-orange-500"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                  }`
                }
              >
                {child.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

