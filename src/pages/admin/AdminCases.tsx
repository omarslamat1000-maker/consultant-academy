import { useEffect, useState } from "react";
import { LEVEL_LABELS, SECTOR_LABELS, SKILL_LABELS } from "../../../shared/types.ts";
import { Alert, Badge, Card, Loading, formatDate } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";

export function AdminCases() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<any | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setList(await adminApi.cases.listForReview(status));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function view(c: any) {
    setOpen(c);
    setAttempts(await adminApi.cases.attemptsForCase(c.id).catch(() => []));
  }
  async function review(c: any, s: "approved" | "rejected" | "pending", ref: boolean) {
    try {
      await adminApi.reviewCase(c.id, s, ref);
      setMsg("تم تحديث حالة المراجعة.");
      setOpen(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function humanScore(a: any, v: string) {
    const n = v === "" ? null : Number(v);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) return;
    try {
      await adminApi.cases.setHumanScore(a.id, n);
      setAttempts((s) => s.map((x) => (x.id === a.id ? { ...x, human_score: n } : x)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Card
        title="مراجعة الحالات المولدة"
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="حالة المراجعة" style={{ width: "auto" }}>
            <option value="pending">بانتظار المراجعة</option>
            <option value="approved">معتمدة</option>
            <option value="rejected">مرفوضة</option>
            <option value="all">الكل</option>
          </select>
        }
      >
        <p className="muted small">اعتماد الحالة يسمح بوضعها كمثال مرجعي، والتقييم البشري للمحاولات يُستخدم لقياس الانحراف بين التقييم الآلي والبشري.</p>
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <p className="muted">لا توجد حالات.</p>
        ) : (
          list.map((c) => (
            <div className="list-item" key={c.id}>
              <div>
                <b>{c.title}</b>
                <div className="small muted">
                  {SECTOR_LABELS[c.sector as keyof typeof SECTOR_LABELS]} · {SKILL_LABELS[c.skill as keyof typeof SKILL_LABELS]?.ar} · {LEVEL_LABELS[c.level as keyof typeof LEVEL_LABELS]} · تشابه {Number(c.similarity_score).toFixed(2)} · {c.prompt_version} · {formatDate(c.created_at)}
                </div>
              </div>
              <div className="btn-row">
                <Badge tone={c.review_status === "approved" ? "green" : c.review_status === "rejected" ? "red" : "amber"}>{c.review_status}</Badge>
                {c.is_reference_example && <Badge tone="gold">مرجعية</Badge>}
                <button className="btn btn-sm btn-outline" onClick={() => void view(c)} type="button">
                  عرض
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
      {open && (
        <Card title={open.title} actions={<button className="btn btn-sm btn-ghost" onClick={() => setOpen(null)} type="button">إغلاق</button>}>
          <div className="btn-row" style={{ marginBottom: "0.75rem" }}>
            <button className="btn btn-sm btn-primary" onClick={() => void review(open, "approved", false)} type="button">
              اعتماد
            </button>
            <button className="btn btn-sm btn-gold" onClick={() => void review(open, "approved", true)} type="button">
              اعتماد كمثال مرجعي
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => void review(open, "rejected", false)} type="button">
              رفض
            </button>
          </div>
          <details open>
            <summary>محتوى الحالة</summary>
            <pre style={{ whiteSpace: "pre-wrap", direction: "rtl", textAlign: "right" }}>{JSON.stringify(open.content, null, 2)}</pre>
          </details>
          <h4 style={{ marginTop: "1rem" }}>المحاولات ({attempts.length})</h4>
          {attempts.map((a) => (
            <div className="list-item" key={a.id}>
              <div>
                <div className="small muted">
                  {formatDate(a.created_at)} · {a.evaluation_type} · الدرجة الآلية {Math.round(Number(a.score))}
                </div>
                <div className="small" style={{ whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
                  {a.answer_text}
                </div>
              </div>
              <div>
                <label className="small muted" htmlFor={`hs-${a.id}`}>
                  تقييم بشري (0-100)
                </label>
                <input id={`hs-${a.id}`} type="number" min={0} max={100} defaultValue={a.human_score ?? ""} onBlur={(e) => void humanScore(a, e.target.value)} style={{ width: 110 }} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
