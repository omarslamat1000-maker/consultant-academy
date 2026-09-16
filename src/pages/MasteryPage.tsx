import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PeerComparison, RecommendationBundle } from "../../shared/api-types.ts";
import { collectRecurringErrors } from "../../shared/recommendation-engine.ts";
import { LEVEL_LABELS, SKILLS, SKILL_LABELS, type MasteryRecord } from "../../shared/types.ts";
import { LineChart } from "../components/charts.tsx";
import { Badge, Card, ErrorState, Loading, ProgressBar, formatRelative } from "../components/ui.tsx";
import { errorMessage } from "../lib/api.ts";
import { data, type AttemptListItem } from "../lib/data.ts";

export function MasteryPage() {
  const [mastery, setMastery] = useState<MasteryRecord[]>([]);
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [rec, setRec] = useState<RecommendationBundle | null>(null);
  const [peers, setPeers] = useState<PeerComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, a, r] = await Promise.all([data.getMastery(), data.listAttempts(), data.getRecommendation()]);
      setMastery(m);
      setAttempts(a);
      setRec(r);
      data.getPeerComparison().then(setPeers).catch(() => setPeers(null));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const recurring = useMemo(() => collectRecurringErrors(attempts.map((a) => a.feedback?.gaps ?? [])), [attempts]);
  const trend = useMemo(
    () =>
      attempts
        .slice(0, 20)
        .reverse()
        .map((a, i) => ({ x: `${i + 1}`, y: Math.round(a.score) })),
    [attempts],
  );

  if (loading) return <Loading label="جارٍ تحميل ملف الإتقان…" />;
  if (error || !rec) return <ErrorState message={error ?? "تعذر التحميل."} onRetry={() => void load()} />;
  const map = new Map(mastery.map((m) => [m.skill, m]));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>ملف الإتقان</h1>
          <p className="muted">درجة إتقان متحركة لكل مهارة (وزن أكبر للمحاولات الحديثة)، والاتجاه عبر الزمن، والفجوات المتكررة، وخطة التطوير.</p>
        </div>
      </div>
      <div className="two-col">
        <div>
          <Card title="تقييم كل مهارة">
            {SKILLS.map((s) => {
              const m = map.get(s);
              const v = m?.score ?? 0;
              return (
                <div className="dim-row" key={s}>
                  <span className="dim-label">
                    {SKILL_LABELS[s].ar}
                    <div className="small muted">{m ? `${m.evidence_count} أدلة · ${formatRelative(m.updated_at)}` : "لم تُمارَس بعد"}</div>
                  </span>
                  <ProgressBar value={v} tone={v < 55 ? "red" : v < 70 ? "gold" : undefined} label={SKILL_LABELS[s].ar} />
                  <span className="dim-score">{Math.round(v)}</span>
                </div>
              );
            })}
          </Card>
          <Card title="مقارنة مجهولة بالأقران" actions={peers?.computed_locally ? <Badge tone="amber">مجموعة افتراضية (تجريبي)</Badge> : peers ? <Badge>{peers.cohort_size} متدربًا</Badge> : null}>
            {!peers ? (
              <p className="muted small">غير متاحة الآن.</p>
            ) : !peers.enough_data ? (
              <p className="muted small">تظهر المقارنة عند وجود 3 متدربين على الأقل لديهم درجات إتقان (بلا أسماء أو معرفات).</p>
            ) : (
              <>
                {peers.overall_percentile !== null && (
                  <p style={{ margin: "0 0 0.5rem" }}>
                    متوسط إتقانك أعلى من <b>{peers.overall_percentile}%</b> من الأقران.
                  </p>
                )}
                {peers.skills
                  .filter((p) => p.percentile !== null)
                  .map((p) => (
                    <div key={p.skill} style={{ marginBottom: "0.4rem" }}>
                      <div className="small" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{SKILL_LABELS[p.skill].ar}</span>
                        <span className="muted">
                          أنت {p.my_score} · الوسيط {p.median} · أعلى من {p.percentile}%
                        </span>
                      </div>
                      <ProgressBar value={p.percentile ?? 0} label={`النسبة المئوية في ${SKILL_LABELS[p.skill].ar}`} />
                    </div>
                  ))}
                {peers.skills.every((p) => p.percentile === null) && <p className="muted small">لا توجد لديك درجات إتقان بعد؛ أكمل حالة أو اختبارًا لتظهر المقارنة.</p>}
              </>
            )}
          </Card>
          <Card title="الاتجاه عبر الزمن (آخر 20 حالة)">
            <LineChart points={trend} label="اتجاه درجات الحالات" />
          </Card>
          <Card title="الفجوات المتكررة">
            {recurring.length ? (
              <ul>
                {recurring.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">لا توجد فجوات متكررة مكتشفة بعد (تحتاج محاولتين على الأقل بالفجوة نفسها).</p>
            )}
          </Card>
        </div>
        <div>
          <Card title="شروط المستوى التالي" actions={<Badge tone="green">{LEVEL_LABELS[rec.level_report.current_level]}</Badge>}>
            {rec.level_report.next_level ? (
              <ul className="req-list" style={{ listStyle: "none", padding: 0 }}>
                {rec.level_report.requirements.map((r) => (
                  <li key={r.key} className={r.met ? "met" : ""}>
                    <span>{r.label}</span>
                    <span className="st">{r.met ? "✓" : r.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">أنت في أعلى مستوى.</p>
            )}
            {rec.level_report.regression_detected && <p className="small" style={{ color: "var(--amber-600)" }}>تراجع مكتشف: مراجعة موجهة دون خفض للمستوى.</p>}
          </Card>
          <Card title="خطة التطوير">
            <ul>
              {rec.development_plan.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </Card>
          <Card title="التوصيات الأسبوعية" actions={rec.ai_plan ? <Badge tone="gold">ذكاء اصطناعي</Badge> : <Badge>قاعدية</Badge>}>
            <ul>
              {rec.weekly_plan.map((d, i) => (
                <li key={i}>
                  <b>{d.day}:</b> {d.activity}
                </li>
              ))}
            </ul>
            <Link to="/simulator" className="btn btn-gold btn-sm">
              ابدأ حالة الآن
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
