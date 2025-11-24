import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import PageHeader from "../../components/ui/PageHeader";
import { calculatePeriodRange, formatPeriodDescription } from "../../utils/periodUtils";
import { formatDateOnlyYYYYMMDD, parseDateOnlyYYYYMMDD } from "../../lib/datetime";
// Старая версия с табами - оставляем для обратной совместимости
import OverviewTab from "./analytics/OverviewTab";
import SubscriptionsTab from "./analytics/SubscriptionsTab";
import TeachersTab from "./analytics/TeachersTab";
import LessonsTab from "./analytics/LessonsTab";
import RevenueTab from "./analytics/RevenueTab";

export default function AdminAnalyticsPage() {
  const { role } = useAuth();

  // Фильтры периода (общие для всех вкладок)
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [baseDate, setBaseDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);

  // Активная вкладка
  const [activeTab, setActiveTab] = useState("overview");

  // Вычисляем диапазон дат для фильтра
  const periodRange = useMemo(() => {
    return calculatePeriodRange(selectedPeriod, baseDate, customFrom, customTo);
  }, [selectedPeriod, baseDate, customFrom, customTo]);

  // Форматируем описание периода
  const periodDescription = useMemo(() => {
    return formatPeriodDescription(selectedPeriod, customFrom, customTo);
  }, [selectedPeriod, customFrom, customTo]);

  // Проверка доступа
  if (role !== "admin") {
    return (
      <div className="p-6">
        <p className="text-red-600">Доступ запрещён. Только для администраторов.</p>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Обзор" },
    { id: "subscriptions", label: "Абонементы" },
    { id: "teachers", label: "Преподаватели" },
    { id: "lessons", label: "Занятия" },
    { id: "revenue", label: "Выручка" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Аналитика" description={periodDescription} />

      {/* Фильтры периода */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Период</label>
          <div className="flex flex-wrap gap-2">
            {["week", "month", "all", "custom"].map((period) => (
              <button
                key={period}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? "bg-brand text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period === "week"
                  ? "Неделя"
                  : period === "month"
                  ? "Месяц"
                  : period === "all"
                  ? "Всё время"
                  : "Свой период"}
              </button>
            ))}
          </div>

          {/* Кастомный диапазон дат */}
          {selectedPeriod === "custom" && (
            <div className="mt-4 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Дата от</label>
                <input
                  type="date"
                  value={customFrom ? formatDateOnlyYYYYMMDD(customFrom) : ""}
                  onChange={(e) => {
                    const date = e.target.value ? parseDateOnlyYYYYMMDD(e.target.value) : null;
                    setCustomFrom(date);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Дата до</label>
                <input
                  type="date"
                  value={customTo ? formatDateOnlyYYYYMMDD(customTo) : ""}
                  onChange={(e) => {
                    const date = e.target.value ? parseDateOnlyYYYYMMDD(e.target.value) : null;
                    setCustomTo(date);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Табы */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? "border-orange-400 text-orange-500"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Контент вкладок */}
      <div>
        {activeTab === "overview" && <OverviewTab periodRange={periodRange} />}
        {activeTab === "subscriptions" && <SubscriptionsTab periodRange={periodRange} />}
        {activeTab === "teachers" && <TeachersTab periodRange={periodRange} />}
        {activeTab === "lessons" && <LessonsTab periodRange={periodRange} />}
        {activeTab === "revenue" && <RevenueTab periodRange={periodRange} />}
      </div>
    </div>
  );
}

