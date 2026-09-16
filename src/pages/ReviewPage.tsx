import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ReviewCardView, ReviewGradeOutcome } from "../../shared/api-types.ts";
import { REVIEW_INTERVALS_DAYS } from "../../shared/review.ts";
import type { QuizUserAnswer } from "../../shared/types.ts";
import { QuizRunner } from "../components/QuizRunner.tsx";
import { Alert, Badge, Card, EmptyState, ErrorState, Loading, Stat, formatDate } from "../components/ui.tsx";
import { errorMessage } from "../lib/api.ts";
import { data } from "../lib/data.ts";

export function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [due, setDue] = useState<ReviewCardView[]>([]);
  const [stats, setStats] = useState<{ total: number; due: number; mastered: number }>({ total: 0, due: 0, mastered: 0 });
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<QuizUserAnswer | undefined>(undefined);
  const [graded, setGraded] = useState<ReviewGradeOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{ done: number; correct: number }>({ done: 0, correct: 0 });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await data.listReviewDue();
      setDue(r.due);
      setStats({ total: r.total_cards, due: r.due_count, mastered: r.mastered_count });
      setIdx(0);
      setAnswer(undefined);
      setGraded(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loading label="جارٍ تحميل بطاقات المراجعة…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const current = due[idx];

  async function check() {
    if (!current || !answer) return;
    setBusy(true);
    try {
      const r = await data.gradeReview(current.card.id, answer);
      setGraded(r);
      setSession((s) => ({ done: s.done + 1, correct: s.correct + (r.graded.correct ? 1 : 0) }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setGraded(null);
    setAnswer(undefined);
    setIdx((i) => i + 1);
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>المراجعة المتباعدة</h1>
          <p className="muted">
            بطاقة لكل سؤال أخطأت فيه في اختبارات الوحدات. الإجابة الصحيحة تُبعد المراجعة التالية ({REVIEW_INTERVALS_DAYS.join(" ← ")} يومًا)، والخطأ يعيدها إلى الغد.
          </p>
        </div>
        <Link to="/path" className="btn btn-outline">
          المسار التدريبي
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: "1rem" }}>
        <Stat label="مستحقة الآن" value={stats.due} hint="تظهر عند حلول موعدها" />
        <Stat label="إجمالي البطاقات" value={stats.total} hint="من أخطاء الاختبارات" />
        <Stat label="متقنة" value={stats.mastered} hint="4 مراجعات صحيحة متتالية" />
        <Stat label="هذه الجلسة" value={`${session.correct} / ${session.done}`} hint="صحيح / مُراجَع" />
      </div>

      {due.length === 0 ? (
        <EmptyState
          title="لا توجد بطاقات مستحقة الآن"
          hint={stats.total === 0 ? "تُنشأ البطاقات تلقائيًا من الأسئلة التي تخطئ فيها في اختبارات الوحدات." : "عُد لاحقًا؛ ستظهر البطاقات عند حلول موعدها."}
          action={
            <Link to="/path" className="btn btn-primary">
              افتح وحدة
            </Link>
          }
        />
      ) : !current ? (
        <Card>
          <Alert tone="success">أنهيت كل البطاقات المستحقة في هذه الجلسة: {session.correct} صحيحة من {session.done}.</Alert>
          <button className="btn btn-primary" type="button" onClick={() => void load()}>
            تحديث القائمة
          </button>
        </Card>
      ) : (
        <Card
          title={
            <span>
              البطاقة {idx + 1} من {due.length} <Badge>{current.module_title}</Badge>
            </span>
          }
          actions={
            <span className="small muted">
              السلسلة: {current.card.streak} · المراجعات: {current.card.reviews} · مستحقة منذ {formatDate(current.card.due_at)}
            </span>
          }
        >
          <QuizRunner questions={[current.question]} answers={answer ? { [current.question.id]: answer } : {}} onChange={(_id, a) => setAnswer(a)} disabled={Boolean(graded)} graded={graded ? [graded.graded] : undefined} />
          {graded && (
            <Alert tone={graded.graded.correct ? "success" : "warn"}>
              <b>{graded.graded.correct ? "صحيح." : "غير صحيح."}</b> {graded.explanation}
              <div className="small" style={{ marginTop: "0.35rem" }}>
                {graded.graded.correct ? `المراجعة التالية بعد ${graded.card.interval_days} ${graded.card.interval_days === 1 ? "يوم" : "أيام"}.` : "ستعود البطاقة غدًا."}
                {!graded.graded.correct && graded.graded.expected_summary && <> الإجابة المتوقعة: {graded.graded.expected_summary}</>}
              </div>
            </Alert>
          )}
          <div className="btn-row">
            {!graded ? (
              <button className="btn btn-primary" type="button" disabled={!answer || busy} onClick={() => void check()}>
                تحقق
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={next}>
                {idx + 1 < due.length ? "البطاقة التالية" : "إنهاء"}
              </button>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
