// ============================================================
// هيكل التطبيق: شريط جانبي RTL بعلامة شجرة القضايا + محتوى، مع تنقل للجوال
// ============================================================
import { NavLink, Outlet } from "react-router-dom";
import { LEVEL_LABELS } from "../../shared/types.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { APP_NAME, APP_VERSION } from "../lib/config.ts";
import { TreeMotif } from "./TreeMotif.tsx";

const LINKS = [
  { to: "/", label: "لوحة التقدم", icon: "▦" },
  { to: "/path", label: "المسار التدريبي", icon: "▤" },
  { to: "/simulator", label: "محاكاة الحالة", icon: "◈" },
  { to: "/library", label: "مكتبة الحالات", icon: "▣" },
  { to: "/review", label: "المراجعة", icon: "↻" },
  { to: "/history", label: "سجل الممارسة", icon: "≡" },
  { to: "/mastery", label: "ملف الإتقان", icon: "◔" },
];
const ADMIN_LINKS = [
  { to: "/admin", label: "لوحة المسؤول", icon: "⚙" },
  { to: "/admin/provider", label: "مفتاح API", icon: "🔑" },
];

export function AppShell() {
  const { profile, role, signOut, isDemo, user } = useAuth();
  const links = role === "admin" ? [...LINKS, ...ADMIN_LINKS] : LINKS;
  return (
    <>
      <a href="#main" className="skip-link">
        تخطي إلى المحتوى
      </a>
      {isDemo && <div className="demo-banner">وضع تجريبي: البيانات محفوظة في هذا المتصفح فقط، والتقييم محلي مبسّط وليس ذكاءً اصطناعيًا. اربط Supabase وGemini للوضع الكامل.</div>}
      <div className="app-shell">
        <aside className="sidebar" aria-label="التنقل الرئيس">
          <TreeMotif className="tree-watermark" size={260} animated={false} />
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <TreeMotif size={28} animated={false} />
            </div>
            <div>
              <p className="brand-title">{APP_NAME}</p>
              <p className="brand-sub">مهارات حل المشكلات الاستشارية</p>
            </div>
          </div>
          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/" || l.to === "/admin"} className={({ isActive }) => (isActive ? "active" : "")}>
                <span className="ico" aria-hidden="true">
                  {l.icon}
                </span>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div style={{ fontWeight: 700 }}>{profile?.display_name || user?.email || "متدرب"}</div>
            <div style={{ opacity: 0.8 }}>
              المستوى: {profile ? LEVEL_LABELS[profile.level] : "—"} · {role === "admin" ? "مسؤول" : "متدرب"}
            </div>
            <div className="btn-row" style={{ marginTop: "0.5rem" }}>
              <NavLink to="/profile" className="btn btn-sm btn-ghost" style={{ color: "#fff" }}>
                الملف الشخصي
              </NavLink>
              <button className="btn btn-sm btn-ghost" style={{ color: "#fff" }} onClick={() => void signOut()}>
                تسجيل الخروج
              </button>
            </div>
            <div style={{ opacity: 0.55, fontSize: "0.75rem", marginTop: "0.5rem" }}>الإصدار {APP_VERSION}</div>
          </div>
        </aside>
        <div>
          <nav className="mobile-nav" aria-label="التنقل (جوال)">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/" || l.to === "/admin"} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/profile">الملف</NavLink>
            <a
              href="#logout"
              onClick={(e) => {
                e.preventDefault();
                void signOut();
              }}
              style={{ marginInlineStart: "auto" }}
            >
              خروج
            </a>
          </nav>
          <main id="main" className="main">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
