import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Alert } from "../../components/ui.tsx";
import { useAuth } from "../../context/AuthContext.tsx";

const TABS = [
  { to: "/admin", label: "الإحصاءات", end: true },
  { to: "/admin/users", label: "المستخدمون" },
  { to: "/admin/modules", label: "الوحدات" },
  { to: "/admin/questions", label: "بنك الأسئلة" },
  { to: "/admin/cases", label: "مراجعة الحالات" },
  { to: "/admin/prompts", label: "Prompts" },
  { to: "/admin/provider", label: "مزود الذكاء الاصطناعي" },
  { to: "/admin/audit", label: "سجل العمليات" },
];

export function AdminLayout() {
  const { isDemo } = useAuth();
  const [health, setHealth] = useState<{ ok: boolean; supabase: boolean } | null | "down">(null);

  useEffect(() => {
    if (isDemo) return;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("down"))))
      .then((h) => setHealth(h))
      .catch(() => setHealth("down"));
  }, [isDemo]);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">الإدارة</p>
          <h1>لوحة المسؤول</h1>
        </div>
      </div>
      {isDemo && <Alert tone="warn">لوحة المسؤول تعمل في الوضع الكامل فقط (Supabase + Netlify Functions).</Alert>}
      {health === "down" && <Alert tone="error">الوظائف الخادمية غير متاحة: صفحات الإحصاءات والمستخدمين وPrompts ومزود الذكاء تعتمد عليها. انشر على Netlify أو شغّل npm run dev:api محليًا.</Alert>}
      {health && health !== "down" && !health.supabase && (
        <Alert tone="warn">الوظائف الخادمية تعمل لكنها غير متصلة بقاعدة البيانات: اضبط SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY في متغيرات بيئة Netlify (أو .env محليًا). إدارة الوحدات والأسئلة ومراجعة الحالات وسجل العمليات تعمل مباشرة عبر Data API.</Alert>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} role="tab" style={{ textDecoration: "none" }}>
            {({ isActive }) => (
              <button type="button" aria-selected={isActive} tabIndex={-1}>
                {t.label}
              </button>
            )}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </>
  );
}
