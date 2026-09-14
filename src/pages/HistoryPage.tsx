import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LEVELS, LEVEL_LABELS, SKILLS, SKILL_LABELS, type Level, type SkillKey } from "../../shared/types.ts";
import { DimensionBars } from "../components/charts.tsx";
import { Badge, Card, EmptyState, ErrorState, Loading, formatDate, scoreTone } from "../components/ui.tsx";
import { errorMessage } from "../lib/api.ts";
import { data, type AttemptListItem } from "../lib/data.ts";

export function HistoryPage() {
  const [items, setItems] = useState<AttemptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState<SkillKey | "">("");
  const [level, setLevel] = useState<Level | "">("");
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await data.listAttempts());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () => items.filter((a) => (!skill || a.skill === skill) && (!level || a.level === level) && (!q || a.case_title.includes(q) || a.answer_text.includes(q))),
    [items, skill, level, q],
  );

  if (loading) return <Loading label="جارٍ تحميل السجل…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>سجل الممارسة</h1>
          <p className="muted">جميع الحالات السابقة مع النتيجة والتقييم. يمكنك إعادة أي حالة صراحة.</p>
        </div>
        <Link to="/simulator" className="btn btn-gold">
          حالة جديدة
        </Link>
      </div>
      <div className="filters">
        <div className="field">
          <label htmlFor="q">بحث</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="عنوان الحالة أو نص الإجابة" />
        </div>
        <div className="field">
          <label htmlFor="fs">المهارة</label>
          <select id="fs" value={skill} onChange={(e) => setSkill(e.target.value as SkillKey | "")}>
            <option value="">الكل</option>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {SKILL_LABELS[s].ar}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fl">المستوى</label>
          <select id="fl" value={level} onChange={(e) => setLevel(e.target.value as Level | "")}>
            <option value="">الكل</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="لا توجد محاولات" hint="ابدأ أول حالة من محاكاة الحالة." action={<Link to="/simulator" className="btn btn-primary">ابدأ الآن</Link>} />
      ) : (
        <Card>
          {filtered.map((a) => (
            <div key={a.id}>
              <div className="list-item">
                <div>
                  <b>{a.case_title}</b>
                  <div className="small muted">
                    {formatDate(a.created_at)} · {a.skill ? SKILL_LABELS[a.skill].ar : "—"} · {a.level ? LEVEL_LABELS[a.level] : "—"} · {a.evaluation_type === "ai" ? "تقييم ذكي" : "تقييم محلي"}
                  </div>
                </div>
                <div className="btn-row">
                  <Badge tone={scoreTone(a.score)}>{Math.round(a.score)} / 100</Badge>
                  <button className="btn btn-sm btn-outline" type="button" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                    {open === a.id ? "إخفاء" : "التفاصيل"}
                  </button>
                  {a.case_id && (
                    <Link to={`/simulator?repeat=${a.case_id}`} className="btn btn-sm btn-primary">
                      إعادة المحاولة
                    </Link>
                  )}
                </div>
              </div>
              {open === a.id && (
                <div style={{ padding: "0.5rem 0 1rem" }}>
                  <DimensionBars scores={a.dimension_scores} />
                  <div className="grid grid-2" style={{ marginTop: "0.75rem" }}>
                    <div>
                      <b>الإجابة</b>
                      <p className="small" style={{ whiteSpace: "pre-wrap" }}>
                        {a.answer_text}
                      </p>
                    </div>
                    <div>
                      <b>أبرز الفجوات</b>
                      <ul className="small">{a.feedback.gaps?.length ? a.feedback.gaps.map((g, i) => <li key={i}>{g}</li>) : <li className="muted">—</li>}</ul>
                      <b>نقاط القوة</b>
                      <ul className="small">{a.feedback.strengths?.length ? a.feedback.strengths.map((g, i) => <li key={i}>{g}</li>) : <li className="muted">—</li>}</ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
