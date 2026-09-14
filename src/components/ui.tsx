// ============================================================
// مكونات واجهة قابلة لإعادة الاستخدام
// ============================================================
import type { ReactNode } from "react";

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-title">
          {typeof title === "string" ? <h3>{title}</h3> : title}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "gray", children }: { tone?: "gray" | "green" | "gold" | "red" | "blue" | "amber"; children: ReactNode }) {
  return <span className={`badge ${tone === "gray" ? "" : `badge-${tone}`}`}>{children}</span>;
}

export function Alert({ tone = "info", children, role }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; role?: string }) {
  const icon = tone === "error" ? "⚠" : tone === "warn" ? "!" : tone === "success" ? "✓" : "ℹ";
  return (
    <div className={`alert alert-${tone}`} role={role ?? (tone === "error" ? "alert" : "status")}>
      <span aria-hidden="true" style={{ fontWeight: 800 }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export function Loading({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <div>{label}</div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <div style={{ fontSize: "2rem" }} aria-hidden="true">
        ◌
      </div>
      <h3 style={{ color: "var(--gray-700)" }}>{title}</h3>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div style={{ fontSize: "2rem", color: "var(--red-600)" }} aria-hidden="true">
        ⚠
      </div>
      <p style={{ color: "var(--red-600)", fontWeight: 600 }}>{message}</p>
      {onRetry && (
        <button className="btn btn-outline" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function ProgressBar({ value, tone, label }: { value: number; tone?: "gold" | "red"; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress ${tone ?? ""}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint && <p className="stat-hint">{hint}</p>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)} type="button">
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** حلقة تقدم دائرية (SVG) */
export function Ring({ value, label, size = 132 }: { value: number; label: string; size?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={v >= 70 ? "var(--green-600)" : v >= 40 ? "var(--gold-500)" : "var(--red-600)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 0.6s var(--ease)" }} />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div className="ring-value">{v}%</div>
        <div className="ring-label">{label}</div>
      </div>
    </div>
  );
}

/** ختم الدرجة النهائية */
export function ScoreStamp({ score, label }: { score: number; label: string }) {
  return (
    <div className="stamp" role="img" aria-label={`الدرجة ${Math.round(score)} من 100 — ${label}`}>
      <div style={{ textAlign: "center" }}>
        <div className="stamp-score">{Math.round(score)}</div>
        <div className="stamp-label">{label}</div>
      </div>
    </div>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "لا نشاط بعد";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${d} يومًا`;
  return formatDate(iso);
}

export function scoreTone(score: number): "green" | "gold" | "red" {
  if (score >= 70) return "green";
  if (score >= 55) return "gold";
  return "red";
}
