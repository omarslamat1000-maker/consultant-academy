// ============================================================
// خدمة المراجعة المتباعدة: البطاقات المستحقة، وتصحيح المراجعة خادميًا وإعادة الجدولة
// ============================================================
import type { ReviewDueOutcome, ReviewGradeOutcome } from "../shared/api-types.ts";
import { gradeQuestion, stripAnswers } from "../shared/quiz-grader.ts";
import { isMastered, nextReviewState } from "../shared/review.ts";
import type { ReviewGradeRequest } from "../shared/schemas.ts";
import type { QuizQuestion, QuizUserAnswer, ReviewCardRecord } from "../shared/types.ts";
import type { AuthedUser } from "./auth.ts";
import { audit } from "./audit.ts";
import { Errors } from "./respond.ts";
import type { AdminClient } from "./supabase-admin.ts";

const MAX_DUE = 20;

function toCard(r: any): ReviewCardRecord {
  return { id: r.id, question_id: r.question_id, due_at: r.due_at, interval_days: Number(r.interval_days), streak: Number(r.streak), reviews: Number(r.reviews), last_result: r.last_result ?? null };
}

export async function listDueCards(admin: AdminClient, user: AuthedUser): Promise<ReviewDueOutcome> {
  const { data: all, error } = await admin.from("review_cards").select("*").eq("user_id", user.id).order("due_at");
  if (error) throw Errors.server();
  const cards = ((all ?? []) as any[]).map(toCard);
  const now = Date.now();
  const due = cards.filter((c) => new Date(c.due_at).getTime() <= now).slice(0, MAX_DUE);
  let views: ReviewDueOutcome["due"] = [];
  if (due.length > 0) {
    const { data: qrows, error: qErr } = await admin.from("question_bank").select("*").in("id", due.map((c) => c.question_id));
    if (qErr) throw Errors.server();
    const questions = (qrows ?? []) as (QuizQuestion & { module_id: string | null })[];
    const moduleIds = [...new Set(questions.map((q) => q.module_id).filter((m): m is string => Boolean(m)))];
    const { data: mods } = moduleIds.length ? await admin.from("modules").select("id, title").in("id", moduleIds) : { data: [] as any[] };
    const titles = new Map(((mods ?? []) as any[]).map((m) => [m.id, m.title as string]));
    const stripped = new Map(stripAnswers(questions).map((q) => [q.id, q]));
    views = due
      .map((card) => {
        const q = stripped.get(card.question_id);
        if (!q) return null;
        const mid = questions.find((x) => x.id === card.question_id)?.module_id ?? null;
        return { card, question: q, module_id: mid, module_title: mid ? (titles.get(mid) ?? "وحدة") : "بنك الأسئلة" };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }
  return { due: views, total_cards: cards.length, due_count: cards.filter((c) => new Date(c.due_at).getTime() <= now).length, mastered_count: cards.filter(isMastered).length };
}

export async function gradeReview(admin: AdminClient, user: AuthedUser, req: ReviewGradeRequest): Promise<ReviewGradeOutcome> {
  const { data: row, error } = await admin.from("review_cards").select("*").eq("id", req.card_id).eq("user_id", user.id).maybeSingle();
  if (error) throw Errors.server();
  if (!row) throw Errors.notFound("بطاقة المراجعة");
  const card = toCard(row);
  const { data: q, error: qErr } = await admin.from("question_bank").select("*").eq("id", card.question_id).maybeSingle();
  if (qErr) throw Errors.server();
  if (!q) throw Errors.notFound("السؤال");
  const question = q as QuizQuestion;
  const answer = req.answer && typeof req.answer === "object" ? (req.answer as QuizUserAnswer) : undefined;
  const graded = gradeQuestion(question, answer);
  const next = nextReviewState(card, graded.correct);
  const { error: upErr } = await admin.from("review_cards").update({ ...next, updated_at: new Date().toISOString() }).eq("id", card.id);
  if (upErr) {
    console.error("[review] update failed:", upErr.message);
    throw Errors.server();
  }
  await audit(admin, user.id, "review.grade", "review_card", card.id, { correct: graded.correct, streak: next.streak, interval_days: next.interval_days });
  return { graded, correct_answer: question.correct_answer ?? null, explanation: question.explanation ?? graded.explanation, card: { ...card, ...next } };
}
