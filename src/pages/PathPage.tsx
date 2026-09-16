import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LEVELS, LEVEL_LABELS, LEVEL_ORDER, SKILL_LABELS, type ModuleSummary, type ProgressRecord } from "../../shared/types.ts";
import { Badge, Card, ErrorState, Loading, ProgressBar } from "../components/ui.tsx";
import { isPriorityModule, orderModulesForTrack } from "../../shared/tracks.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { errorMessage } from "../lib/api.ts";
import { data } from "../lib/data.ts";

export function PathPage() {
  const { profile } = useAuth();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRecord>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await data.listModules();
      setModules(r.modules.filter((m) => m.is_published));
      setProgress(r.progress);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loading label="جارٍ تحميل المسار…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const userLevelIdx = LEVEL_ORDER[profile?.level ?? "beginner"];
  const total = modules.length;
  const done = modules.filter((m) => progress[m.id]?.completed).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>المسار التدريبي</h1>
          <p className="muted">12 وحدة عبر أربعة مستويات. تُفتح وحدات المستوى الأعلى عند الانتقال إليه وفق قواعد واضحة.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="small muted">
            الإكمال: {done} من {total}
          </div>
          <ProgressBar value={total ? (done / total) * 100 : 0} label="إكمال المسار" />
        </div>
      </div>
      {LEVELS.map((lvl) => {
        const list = orderModulesForTrack(modules.filter((m) => m.level === lvl), profile?.track ?? null);
        if (list.length === 0) return null;
        const locked = LEVEL_ORDER[lvl] > userLevelIdx;
        return (
          <section key={lvl} aria-label={`مستوى ${LEVEL_LABELS[lvl]}`}>
            <div className="level-band">
              <h2>المستوى: {LEVEL_LABELS[lvl]}</h2>
              {locked && <Badge tone="amber">مقفل — يتطلب الانتقال إلى هذا المستوى</Badge>}
              <div className="line" />
            </div>
            {list.map((m) => {
              const p = progress[m.id];
              const status = p?.completed ? "مكتملة" : p ? "قيد التقدم" : "لم تبدأ";
              return (
                <Card key={m.id} className={locked ? "module-card locked" : "module-card"}>
                  <div>
                    <div className="btn-row" style={{ marginBottom: "0.3rem" }}>
                      <h3 style={{ margin: 0 }}>
                        {m.order_index}. {m.title}
                      </h3>
                      <Badge tone={p?.completed ? "green" : p ? "gold" : "gray"}>{status}</Badge>
                      <Badge tone="blue">{SKILL_LABELS[m.primary_skill].ar}</Badge>
                      {isPriorityModule(m, profile?.track ?? null) && <Badge tone="gold">أولوية مسارك</Badge>}
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      {m.description}
                    </p>
                    {p && (
                      <p className="small muted" style={{ margin: "0.3rem 0 0" }}>
                        أفضل نتيجة: {Math.round(p.best_score)}% · المحاولات: {p.attempts_count}
                      </p>
                    )}
                    {locked && <p className="small muted">شرط الفتح: إكمال وحدات المستوى الحالي، 70% في ثلاثة اختبارات وثلاث حالات غير مكررة، وحد أدنى في المهارات الرئيسة.</p>}
                  </div>
                  <div>
                    {locked ? (
                      <button className="btn btn-outline" disabled>
                        مقفل
                      </button>
                    ) : (
                      <Link to={`/modules/${m.id}`} className="btn btn-primary">
                        {p?.completed ? "مراجعة" : p ? "متابعة" : "بدء"}
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
