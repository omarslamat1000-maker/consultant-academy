import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { QuizOutcome } from "../../shared/api-types.ts";
import { LEVEL_LABELS, SKILL_LABELS, type ModuleFull, type ProgressRecord, type QuizAttemptRecord, type QuizUserAnswer } from "../../shared/types.ts";
import { QuizRunner } from "../components/QuizRunner.tsx";
import { Alert, Badge, Card, ErrorState, Loading, ProgressBar, Tabs, formatDate } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { errorMessage } from "../lib/api.ts";
import { data } from "../lib/data.ts";

const TABS = [
  { id: "explain", label: "الشرح" },
  { id: "examples", label: "الأمثلة" },
  { id: "practice", label: "التمرين وقائمة التحقق" },
  { id: "quiz", label: "الاختبار القصير" },
  { id: "case", label: "الحالة التطبيقية" },
  { id: "result", label: "النتيجة" },
];

export function ModulePage() {
  const { id = "" } = useParams();
  const { isDemo } = useAuth();
  const [mod, setMod] = useState<ModuleFull | null>(null);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [history, setHistory] = useState<QuizAttemptRecord[]>([]);
  const [tab, setTab] = useState("explain");
  const [answers, setAnswers] = useState<Record<string, QuizUserAnswer>>({});
  const [applied, setApplied] = useState("");
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await data.getModule(id);
      setMod(r.module);
      setProgress(r.progress);
      setHistory(r.quiz_history);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Loading label="جارٍ تحميل الوحدة…" />;
  if (error || !mod) return <ErrorState message={error ?? "الوحدة غير موجودة."} onRetry={() => void load()} />;
  const c = mod.content;
  const answered = mod.questions.filter((q) => answers[q.id] !== undefined).length;

  async function submit() {
    if (!mod) return;
    setError(null);
    if (answered < mod.questions.length) {
      setError(`أجب عن جميع الأسئلة أولًا (${answered} من ${mod.questions.length}).`);
      return;
    }
    setBusy(true);
    try {
      const r = await data.submitQuiz(mod.id, answers, applied.trim().length >= 40 ? applied.trim() : undefined, Math.round((Date.now() - started.current) / 1000));
      setOutcome(r);
      setProgress({ module_id: mod.id, best_score: r.best_score, attempts_count: r.attempts_count, completed: r.completed, last_activity_at: new Date().toISOString() });
      setTab("result");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setAnswers({});
    setApplied("");
    setOutcome(null);
    started.current = Date.now();
    setTab("quiz");
  }

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            <Link to="/path">المسار التدريبي</Link> / الوحدة {mod.order_index}
          </p>
          <h1>{mod.title}</h1>
          <div className="btn-row">
            <Badge tone="green">{LEVEL_LABELS[mod.level]}</Badge>
            <Badge tone="blue">{SKILL_LABELS[mod.primary_skill].ar}</Badge>
            {progress?.completed && <Badge tone="gold">مكتملة</Badge>}
          </div>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="small muted">أفضل نتيجة: {progress ? `${Math.round(progress.best_score)}%` : "—"}</div>
          <ProgressBar value={progress?.best_score ?? 0} label="أفضل نتيجة" />
        </div>
      </div>

      <Card>
        <b>هدف التعلم:</b> {c.learning_objective}
        <p className="small muted" style={{ margin: "0.5rem 0 0" }}>
          شرط إكمال الوحدة: {c.completion_rule.description}
        </p>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "explain" && (
        <>
          <Card title="الشرح التفصيلي">
            {c.explanation.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Card>
          <Card title="المصطلحات الأساسية">
            {c.terms.map((t) => (
              <div className="term" key={t.en}>
                <b>{t.ar}</b> <span className="en">{t.en}</span>
                <div className="small">{t.definition}</div>
              </div>
            ))}
          </Card>
          <Card title="خطوات تطبيق المنهجية">
            <ol>
              {c.method_steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </Card>
        </>
      )}

      {tab === "examples" && (
        <>
          {[
            ["مثال بسيط", c.example_simple],
            ["مثال متوسط", c.example_medium],
            ["مثال متقدم", c.example_advanced],
          ].map(([label, ex]) => {
            const e = ex as typeof c.example_simple;
            return (
              <Card key={label as string} title={`${label}: ${e.title}`}>
                <div className="example">
                  <b>الموقف:</b> {e.situation}
                </div>
                <div className="example">
                  <b>التطبيق:</b> {e.application}
                </div>
                <div className="example">
                  <b>النتيجة:</b> {e.result}
                </div>
              </Card>
            );
          })}
          <Card title="الأخطاء الشائعة">
            <ul>
              {c.common_mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === "practice" && (
        <>
          <Card title="قائمة تحقق للممارسة الصحيحة">
            <ul>
              {c.checklist.map((m, i) => (
                <li key={i}>☐ {m}</li>
              ))}
            </ul>
          </Card>
          <Card title="تمرين تطبيقي">
            <p style={{ whiteSpace: "pre-wrap" }}>{c.exercise.prompt}</p>
            <b>إرشادات:</b>
            <ul>
              {c.exercise.guidance.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
            <p className="muted small">هذا التمرين للممارسة الذاتية؛ الاختبار القصير والحالة التطبيقية هما ما يُحتسب لإكمال الوحدة.</p>
          </Card>
        </>
      )}

      {tab === "quiz" && (
        <>
          {outcome && <Alert tone="info">سبق أن أرسلت هذه المحاولة. يمكنك مراجعة النتيجة أو بدء محاولة جديدة.</Alert>}
          <QuizRunner questions={mod.questions} answers={answers} onChange={(qid, a) => setAnswers((s) => ({ ...s, [qid]: a }))} disabled={Boolean(outcome)} graded={outcome?.result.graded} />
          {!outcome && (
            <Card>
              <p className="muted small">
                أجبت عن {answered} من {mod.questions.length}. بعد الاختبار انتقل إلى «الحالة التطبيقية» ثم أرسل الاثنين معًا.
              </p>
              <button className="btn btn-primary" onClick={() => setTab("case")} type="button">
                التالي: الحالة التطبيقية
              </button>
            </Card>
          )}
        </>
      )}

      {tab === "case" && (
        <Card title={`الحالة التطبيقية: ${c.applied_case.title}`}>
          <p style={{ whiteSpace: "pre-wrap" }}>{c.applied_case.scenario}</p>
          <div className="data-list" style={{ marginBottom: "0.75rem" }}>
            {c.applied_case.data.map((d, i) => (
              <div className="data-item" key={i}>
                <div className="lbl">{d.label}</div>
                <div className="val">{d.value || "—"}</div>
              </div>
            ))}
          </div>
          <p>
            <b>المطلوب:</b> {c.applied_case.task}
          </p>
          <label htmlFor="applied" className="small muted">
            إجابتك (40 حرفًا على الأقل)
          </label>
          <textarea id="applied" value={applied} onChange={(e) => setApplied(e.target.value)} disabled={Boolean(outcome)} style={{ minHeight: 200 }} />
          {error && <Alert tone="error">{error}</Alert>}
          {!outcome && (
            <div className="btn-row" style={{ marginTop: "0.75rem" }}>
              <button className="btn btn-gold" onClick={() => void submit()} disabled={busy} type="button">
                {busy ? "جارٍ التصحيح…" : "إرسال الاختبار والحالة للتقييم"}
              </button>
              <span className="muted small">
                التصحيح حتمي (بالقواعد والكلمات المفتاحية) {isDemo ? "في الوضع التجريبي" : "على الخادم"} — وليس تقييم ذكاء اصطناعي.
              </span>
            </div>
          )}
          {outcome && (
            <Alert tone="success">
              درجة الحالة التطبيقية: <b>{outcome.applied_case_score ?? "لم تُرسل"}</b> (الحد الأدنى {outcome.applied_case_min}). راجع الإجابة النموذجية في تبويب النتيجة.
            </Alert>
          )}
        </Card>
      )}

      {tab === "result" && (
        <>
          {!outcome ? (
            <Card>
              <p className="muted">لم ترسل محاولة بعد في هذه الجلسة.</p>
              {history.length > 0 && (
                <>
                  <b>محاولات سابقة:</b>
                  <ul>
                    {history.map((h) => (
                      <li key={h.id}>
                        {formatDate(h.created_at)} — {Math.round(h.score)}%
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button className="btn btn-primary" onClick={() => setTab("quiz")} type="button">
                ابدأ الاختبار
              </button>
            </Card>
          ) : (
            <>
              <Card title="النتيجة">
                <div className="grid grid-3">
                  <div>
                    <div className="score-big">{Math.round(outcome.result.score)}</div>
                    <div className="muted">الاختبار القصير (الحد الأدنى {outcome.quiz_min})</div>
                  </div>
                  <div>
                    <div className="score-big">{outcome.applied_case_score ?? "—"}</div>
                    <div className="muted">الحالة التطبيقية (الحد الأدنى {outcome.applied_case_min})</div>
                  </div>
                  <div>
                    <div className="score-big" style={{ color: outcome.completed ? "var(--green-600)" : "var(--amber-600)" }}>
                      {outcome.completed ? "✓" : "…"}
                    </div>
                    <div className="muted">{outcome.completed ? "الوحدة مكتملة" : "لم تكتمل بعد"}</div>
                  </div>
                </div>
                {outcome.mastery && (
                  <p className="small muted" style={{ marginTop: "0.75rem" }}>
                    درجة إتقان «{SKILL_LABELS[outcome.mastery.skill].ar}» الآن {Math.round(outcome.mastery.score)} (أدلة: {outcome.mastery.evidence_count}).
                  </p>
                )}
              </Card>
              <Card title="تفسير النتيجة">
                {c.result_interpretation.map((r, i) => (
                  <div key={i} className="example">
                    <b>{r.range}:</b> {r.meaning} <span className="muted">— {r.advice}</span>
                  </div>
                ))}
              </Card>
              <Card title="الإجابة النموذجية للحالة التطبيقية">
                <p style={{ whiteSpace: "pre-wrap" }}>{c.applied_case.model_answer}</p>
              </Card>
              <Card title="التوصية التدريبية التالية">
                <p>{c.next_recommendation}</p>
                <div className="btn-row">
                  <button className="btn btn-outline" onClick={retry} type="button">
                    محاولة جديدة
                  </button>
                  <Link to="/path" className="btn btn-primary">
                    العودة إلى المسار
                  </Link>
                  <Link to="/simulator" className="btn btn-gold">
                    حالة محاكاة
                  </Link>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
