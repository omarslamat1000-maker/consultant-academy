// ============================================================
// خدمة الاختبارات القصيرة: التصحيح خادميًا، الحالة التطبيقية (تغطية حتمية)، حفظ المحاولة والتقدم، تحديث الإتقان
// ============================================================
import { tokenize } from "../shared/fingerprint.ts";
import { gradeQuiz } from "../shared/quiz-grader.ts";
import type { QuizOutcome } from "../shared/api-types.ts";
export type { QuizOutcome };
import { updateMastery } from "../shared/mastery.ts";
import { coverageScore } from "../shared/recommendation-engine.ts";
import type { QuizSubmitRequest } from "../shared/schemas.ts";
import type { ModuleContent, QuizQuestion, QuizUserAnswer, SkillKey } from "../shared/types.ts";
import type { AuthedUser } from "./auth.ts";
import { audit } from "./audit.ts";
import { Errors } from "./respond.ts";
import type { AdminClient } from "./supabase-admin.ts";


export async function submitQuiz(admin: AdminClient, user: AuthedUser, req: QuizSubmitRequest): Promise<QuizOutcome> {
  const { data: mod, error: modErr } = await admin.from("modules").select("id, content, is_published").eq("id", req.module_id).maybeSingle();
  if (modErr) throw Errors.server();
  if (!mod || !mod.is_published) throw Errors.notFound("الوحدة");
  const content = mod.content as ModuleContent & { primary_skill?: SkillKey };

  const { data: qrows, error: qErr } = await admin.from("question_bank").select("*").eq("module_id", req.module_id).eq("is_published", true).order("created_at");
  if (qErr) throw Errors.server();
  const questions = (qrows ?? []) as QuizQuestion[];
  if (questions.length === 0) throw Errors.notFound("أسئلة الوحدة");

  const answers: Record<string, QuizUserAnswer> = {};
  for (const [k, v] of Object.entries(req.answers)) {
    if (v && typeof v === "object") answers[k] = v as QuizUserAnswer;
  }
  const result = gradeQuiz(questions, answers);
  const quizMin = content.completion_rule?.quiz_min_score ?? 70;
  const appliedMin = content.completion_rule?.applied_case_min_score ?? 60;
  const passed = result.score >= quizMin;
  const appliedScore = req.applied_case_answer && req.applied_case_answer.length >= 40 ? coverageScore(content.applied_case?.model_answer ?? "", req.applied_case_answer, tokenize) : null;
  const appliedPassed = appliedScore !== null && appliedScore >= appliedMin;

  await admin.from("quiz_attempts").insert({
    user_id: user.id,
    module_id: req.module_id,
    score: result.score,
    answers: { graded: result.graded.map((g) => ({ question_id: g.question_id, correct: g.correct, partial: g.partial })), applied_case_score: appliedScore },
    duration_seconds: req.duration_seconds,
  });

  const { data: prev } = await admin.from("learning_progress").select("best_score, attempts_count, completed").eq("user_id", user.id).eq("module_id", req.module_id).maybeSingle();
  const best = Math.max(Number(prev?.best_score ?? 0), result.score);
  const attemptsCount = Number(prev?.attempts_count ?? 0) + 1;
  const completed = Boolean(prev?.completed) || (passed && appliedPassed);
  const { error: upErr } = await admin
    .from("learning_progress")
    .upsert({ user_id: user.id, module_id: req.module_id, best_score: best, attempts_count: attemptsCount, completed, last_activity_at: new Date().toISOString() }, { onConflict: "user_id,module_id" });
  if (upErr) {
    console.error("[quiz] progress upsert failed:", upErr.message);
    throw Errors.server();
  }

  let mastery: QuizOutcome["mastery"] = null;
  const skill = content.primary_skill;
  if (skill) {
    const { data: m } = await admin.from("mastery_scores").select("score, evidence_count").eq("user_id", user.id).eq("skill", skill).maybeSingle();
    const combined = appliedScore === null ? result.score : Math.round((result.score * 0.6 + appliedScore * 0.4) * 100) / 100;
    const next = updateMastery(m ? { score: Number(m.score), evidence_count: m.evidence_count } : null, combined);
    await admin.from("mastery_scores").upsert({ user_id: user.id, skill, score: next.score, evidence_count: next.evidence_count, updated_at: new Date().toISOString() }, { onConflict: "user_id,skill" });
    mastery = { skill, ...next };
  }

  await audit(admin, user.id, "quiz.submit", "module", req.module_id, { score: result.score, applied_case_score: appliedScore, passed, completed, attempts_count: attemptsCount });
  return { result, applied_case_score: appliedScore, applied_case_min: appliedMin, quiz_min: quizMin, best_score: best, attempts_count: attemptsCount, completed, passed, mastery };
}
