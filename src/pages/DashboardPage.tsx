import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RecommendationBundle } from "../../shared/api-types.ts";
import { LEVEL_LABELS, SKILL_LABELS } from "../../shared/types.ts";
import { LineChart } from "../components/charts.tsx";
import { TreeMotif } from "../components/TreeMotif.tsx";
import { Alert, Badge, Card, ErrorState, Loading, Ring, Stat, formatRelative } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { errorMessage } from "../lib/api.ts";
import { data, type AttemptListItem } from "../lib/data.ts";

export function DashboardPage() {
  const { profile, refreshProfile } = useAuth();
  const [rec, setRec] = useState<RecommendationBundle | null>(null);
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [modulesDone, setModulesDone] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [reviewDue, setReviewDue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, a, m] = await Promise.all([data.getRecommendation(), data.listAttempts(), data.listModules()]);
      data.listReviewDue().then((d) => setReviewDue(d.due_count)).catch(() => setReviewDue(null));
      setRec(r);
      setAttempts(a);
      setModulesDone({ done: Object.values(m.progress).filter((p) => p.completed).length, total: m.modules.length });
      if (r.promoted_to) await refreshProfile();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading label="جارٍ تحميل لوحة التقدم…" />;
  if (error || !rec) return <ErrorState message={error ?? "تعذر التحميل."} onRetry={() => void load()} />;

  const chartPoints = attempts
    .slice(0, 12)
    .reverse()
    .map((a, i) => ({ x: `${i + 1}`, y: Math.round(a.score) }));
  const pathPct = modulesDone.total ? Math.round((modulesDone.done / modulesDone.total) * 100) : 0;
  const next = rec.next;
  const nextLink =
    next.kind === "case"
      ? `/simulator?skill=${next.skill}&level=${next.level}${next.sector ? `&sector=${next.sector}` : ""}${next.case_type ? `&type=${next.case_type}` : ""}${next.timed ? "&timed=1" : ""}`
      : next.module_id
        ? `/modules/${next.module_id}`
        : "/path";
  const reqMet = rec.level_report.requirements.filter((r) => r.met).length;
  const reqTotal = Math.max(1, rec.level_report.requirements.length);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">لوحة التقدم</p>
          <h1>مرحبًا {profile?.display_name || "بك"}</h1>
          <p className="muted" style={{ margin: 0 }}>
            المستوى الحالي: <Badge tone="green">{LEVEL_LABELS[profile?.level ?? "beginner"]}</Badge> · آخر نشاط: {formatRelative(rec.stats.last_activity_at)}
          </p>
        </div>
        <Link to="/simulator" className="btn btn-gold">
          ابدأ حالة جديدة
        </Link>
      </div>
      {rec.promoted_to && (
        <Alert tone="success">
          تهانينا! انتقلت إلى مستوى {LEVEL_LABELS[rec.promoted_to]} بعد تحقيق جميع الشروط. <Link to="/certificates">اعرض شهادتك</Link>
        </Alert>
      )}
      {reviewDue !== null && reviewDue > 0 && (
        <Alert tone="info">
          لديك {reviewDue} {reviewDue === 1 ? "بطاقة مراجعة مستحقة" : "بطاقات مراجعة مستحقة"} لمفاهيم أخطأت فيها سابقًا. <Link to="/review">ابدأ المراجعة (5 دقائق)</Link>
        </Alert>
      )}
      {rec.level_report.regression_detected && <Alert tone="warn">لاحظنا تراجعًا في آخر محاولاتك. نقترح مراجعة موجهة قبل الحالة التالية (لن يُخفَّض مستواك).</Alert>}
      {rec.computed_locally && <Alert tone="info">التوصية محسوبة من بياناتك مباشرة لأن الوظائف الخادمية غير متاحة الآن؛ الترقية بين المستويات والخطة الذكية تعملان عند اتصالها.</Alert>}

      <section className="directive" aria-label="التوصية التالية">
        <TreeMotif size={240} animated={false} className="tree-bg" />
        <div>
          <p className="eyebrow">الخطوة التالية الموصى بها</p>
          <h2>{next.title}</h2>
          <p>{next.reason}</p>
          <div className="btn-row">
            <Link to={nextLink} className="btn btn-gold">
              {next.kind === "case" ? "ابدأ الحالة" : next.kind === "review" ? "ابدأ المراجعة" : "افتح الوحدة"}
            </Link>
            <Badge>{SKILL_LABELS[next.skill].ar}</Badge>
            <Badge>{LEVEL_LABELS[next.level]}</Badge>
          </div>
        </div>
        <Ring value={(reqMet / reqTotal) * 100} label={rec.level_report.next_level ? `نحو ${LEVEL_LABELS[rec.level_report.next_level]}` : "أعلى مستوى"} />
      </section>

      <div className="grid grid-4">
        <Stat label="نسبة إكمال المسار" value={`${pathPct}%`} hint={`${modulesDone.done} من ${modulesDone.total} وحدة`} />
        <Stat label="متوسط النتيجة" value={rec.stats.avg_score || "—"} hint="من 100 عبر كل الحالات" />
        <Stat label="الحالات المنجزة" value={rec.stats.cases_total} hint={`${rec.stats.cases_unique} حالة غير مكررة`} />
        <Stat label="مدة التدريب" value={`${rec.stats.training_minutes} د`} hint="إجمالي زمن الإجابات" />
      </div>
      <div className="btn-row" style={{ marginTop: "0.75rem" }}>
        <Link to="/library" className="btn btn-sm btn-outline">مكتبة الحالات (50)</Link>
        <Link to="/review" className="btn btn-sm btn-outline">بطاقات المراجعة{reviewDue ? ` (${reviewDue})` : ""}</Link>
        <Link to="/certificates" className="btn btn-sm btn-outline">الشهادات</Link>
      </div>

      <div className="two-col" style={{ marginTop: "1rem" }}>
        <div>
          <Card title="مخطط تطور الأداء (آخر 12 محاولة)">
            <LineChart points={chartPoints} label="تطور درجات الحالات" />
          </Card>
          <Card title="الخطة الأسبوعية" actions={rec.ai_plan ? <Badge tone="gold">مولّدة بالذكاء الاصطناعي</Badge> : <Badge>خطة قاعدية</Badge>}>
            <ul>
              {rec.weekly_plan.map((d, i) => (
                <li key={i}>
                  <b>{d.day}:</b> {d.activity} <span className="muted small">({SKILL_LABELS[d.focus].ar})</span>
                </li>
              ))}
            </ul>
            <p className="muted small" style={{ margin: 0 }}>
              {rec.focus_message}
            </p>
          </Card>
        </div>
        <div>
          <Card title="أقوى المهارات">
            {rec.stats.strong_skills.length ? (
              <ul>
                {rec.stats.strong_skills.map((s) => (
                  <li key={s}>{SKILL_LABELS[s].ar}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">تظهر بعد أول ثلاث محاولات.</p>
            )}
          </Card>
          <Card title="أضعف المهارات">
            {rec.stats.weak_skills.length ? (
              <ul>
                {rec.stats.weak_skills.map((s) => (
                  <li key={s}>{SKILL_LABELS[s].ar}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">تظهر بعد أول ثلاث محاولات.</p>
            )}
          </Card>
          <Card title={`شروط الانتقال إلى ${rec.level_report.next_level ? LEVEL_LABELS[rec.level_report.next_level] : "—"}`}>
            <ul className="req-list" style={{ listStyle: "none", padding: 0 }}>
              {rec.level_report.requirements.map((r) => (
                <li key={r.key} className={r.met ? "met" : ""}>
                  <span>{r.label}</span>
                  <span className="st">{r.met ? "✓" : r.detail}</span>
                </li>
              ))}
            </ul>
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              <Link to="/mastery">تفاصيل ملف الإتقان</Link>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
