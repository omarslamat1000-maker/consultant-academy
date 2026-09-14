import { useEffect, useState } from "react";
import { Card, ErrorState, Loading, Stat, formatDate } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";

export function AdminStats() {
  const [s, setS] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setS(await adminApi.stats());
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!s) return <Loading />;
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
  return (
    <>
      <div className="grid grid-4">
        <Stat label="المستخدمون" value={s.users_total} />
        <Stat label="المحاولات (30 يومًا)" value={s.attempts_30d} hint={`${s.ai_evaluations_30d} تقييم ذكي`} />
        <Stat label="متوسط الدرجات (30 يومًا)" value={s.avg_score_30d} />
        <Stat label="الحالات المولدة (30 يومًا)" value={s.cases_30d} hint={`${s.cases_pending_review} بانتظار المراجعة`} />
      </div>
      <div className="grid grid-4" style={{ marginTop: "1rem" }}>
        <Stat label="نسبة JSON الصالح من أول محاولة" value={pct(s.json_valid_rate)} hint={`إصلاح: ${pct(s.repair_rate)}`} />
        <Stat label="نسبة الحالات المرفوضة للتكرار" value={pct(s.duplicate_rate)} hint={`${s.cases_rejected_duplicate} حالة مرفوضة`} />
        <Stat label="متوسط زمن الاستجابة" value={s.avg_latency_ms === null ? "—" : `${s.avg_latency_ms} ms`} hint={`${s.ai_calls_30d} استدعاء`} />
        <Stat label="الانحراف الآلي/البشري" value={s.human_ai_drift === null ? "—" : `${s.human_ai_drift} نقطة`} hint={`${s.human_scored_count} محاولة مقيّمة بشريًا`} />
      </div>
      <Card title="مقارنة إصدارات Prompt (30 يومًا)">
        {s.prompt_versions?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الإصدار</th>
                  <th>الاستدعاءات</th>
                  <th>JSON صالح</th>
                  <th>مرفوض للتكرار</th>
                  <th>متوسط الزمن</th>
                </tr>
              </thead>
              <tbody>
                {s.prompt_versions.map((v: any) => (
                  <tr key={v.version}>
                    <td dir="ltr" style={{ textAlign: "right" }}>
                      {v.version || "—"}
                    </td>
                    <td>{v.calls}</td>
                    <td>{v.json_valid_rate}%</td>
                    <td>{v.duplicate_rejected}</td>
                    <td>{v.avg_latency_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">لا توجد استدعاءات بعد.</p>
        )}
      </Card>
      <Card title="تقارير الأخطاء الأخيرة">
        {s.recent_errors?.length ? (
          <ul>
            {s.recent_errors.map((e: any, i: number) => (
              <li key={i}>
                <span dir="ltr">{e.kind}</span> — {e.error_code} — {formatDate(e.created_at)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">لا أخطاء مسجلة.</p>
        )}
      </Card>
    </>
  );
}
