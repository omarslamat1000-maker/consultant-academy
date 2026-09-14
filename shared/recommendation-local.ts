// ============================================================
// بناء حزمة التوصية من سجلات خام (حتمي) — مشترك بين الوضع التجريبي والواجهة عند تعذر الوظائف الخادمية
// لا يرقّي المستوى (الترقية خادمية فقط) ولا يولّد خطة ذكية
// ============================================================
import type { RecommendationBundle } from "./api-types.ts";
import { evaluateLevelProgress, type LevelEvidence } from "./level-rules.ts";
import { computeSkillBuckets, decideNext, deterministicPlan, type ModuleLite } from "./recommendation-engine.ts";
import type { AttemptRecord, Level, MasteryRecord, ProgressRecord, QuizAttemptRecord, SectorKey, SkillKey } from "./types.ts";

export interface LocalRecommendationInput {
  level: Level;
  preferred_sector: SectorKey | null;
  modules: ModuleLite[];
  progress: ProgressRecord[];
  /** الأحدث أولًا */
  quiz_attempts: QuizAttemptRecord[];
  /** الأحدث أولًا */
  attempts: Pick<AttemptRecord, "case_id" | "case_fingerprint" | "score" | "duration_seconds" | "created_at" | "feedback">[];
  mastery: MasteryRecord[];
  cases: { id: string; level: Level; sector: string }[];
}

export function buildLocalRecommendation(input: LocalRecommendationInput): RecommendationBundle {
  const { level } = input;
  const completed = new Set(input.progress.filter((p) => p.completed).map((p) => p.module_id));
  const levelModules = input.modules.filter((m) => m.level === level);
  const idsAtLevel = new Set(levelModules.map((m) => m.id));
  const caseMap = new Map(input.cases.map((c) => [c.id, c]));
  const bestByFp = new Map<string, number>();
  for (const a of input.attempts) {
    const c = a.case_id ? caseMap.get(a.case_id) : undefined;
    if (!c || c.level !== level) continue;
    bestByFp.set(a.case_fingerprint, Math.max(bestByFp.get(a.case_fingerprint) ?? 0, a.score));
  }
  const masteryMap: Partial<Record<SkillKey, number>> = {};
  const masteryUpdated: Partial<Record<SkillKey, string>> = {};
  for (const m of input.mastery) {
    masteryMap[m.skill] = m.score;
    masteryUpdated[m.skill] = m.updated_at;
  }
  const evidence: LevelEvidence = {
    level,
    required_modules: levelModules.map((m) => ({ id: m.id, title: m.title, completed: completed.has(m.id) })),
    quiz_scores: input.quiz_attempts.filter((q) => idsAtLevel.has(q.module_id)).map((q) => q.score),
    unique_case_scores: [...bestByFp.values()],
    mastery: masteryMap,
    recent_case_scores: input.attempts.map((a) => a.score),
  };
  const report = evaluateLevelProgress(evidence);
  const avg = input.attempts.length ? Math.round((input.attempts.reduce((x, a) => x + a.score, 0) / input.attempts.length) * 10) / 10 : 0;
  const { strong, weak, stale } = computeSkillBuckets(masteryMap, masteryUpdated);
  const next = decideNext({
    level,
    report,
    modules: input.modules,
    completedModuleIds: completed,
    masteryMap,
    staleSkills: stale,
    weakSkills: weak,
    preferredSector: input.preferred_sector,
    caseSectors: input.cases.map((c) => c.sector),
  });
  const plan = deterministicPlan(weak, stale, strong, report);
  return {
    level_report: report,
    promoted_to: null,
    next,
    weekly_plan: plan.weekly,
    development_plan: plan.development,
    focus_message: plan.focus,
    stats: {
      avg_score: avg,
      cases_total: input.attempts.length,
      cases_unique: new Set(input.attempts.map((a) => a.case_fingerprint)).size,
      strong_skills: strong,
      weak_skills: weak,
      stale_skills: stale,
      last_activity_at: input.attempts[0]?.created_at ?? input.quiz_attempts[0]?.created_at ?? null,
      training_minutes: Math.round(input.attempts.reduce((x, a) => x + (a.duration_seconds ?? 0), 0) / 60),
    },
    ai_plan: false,
  };
}
