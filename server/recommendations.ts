// ============================================================
// محرك التعلم التكيفي (خادمي): تقرير المستوى، الترقية وفق القواعد، التوصية التالية، الخطة الأسبوعية
// ============================================================
import { RECOMMENDATION_RESPONSE_SCHEMA } from "../shared/gemini-schemas.ts";
import { evaluateLevelProgress, type LevelEvidence } from "../shared/level-rules.ts";
import { renderPrompt } from "../shared/prompts/index.ts";
import { collectRecurringErrors, computeSkillBuckets, decideNext, deterministicPlan } from "../shared/recommendation-engine.ts";
import { RecommendationModelOutputSchema } from "../shared/schemas.ts";
import { LEVEL_LABELS, SKILL_LABELS, type Level, type SectorKey, type SkillKey, type WeeklyPlanItem } from "../shared/types.ts";
import type { RecommendationBundle } from "../shared/api-types.ts";
export type { RecommendationBundle };
import type { AuthedUser } from "./auth.ts";
import { audit, recordMetric } from "./audit.ts";
import { loadPrompt } from "./prompts-loader.ts";
import { createProvider, resolveAIConfig } from "./providers/index.ts";
import { callStructured } from "./structured.ts";
import type { AdminClient } from "./supabase-admin.ts";


export async function buildRecommendation(admin: AdminClient, user: AuthedUser): Promise<RecommendationBundle> {
  const level = user.level;
  const [{ data: mods }, { data: progress }, { data: quizzes }, { data: attempts }, { data: mastery }, { data: cases }] = await Promise.all([
    admin.from("modules").select("id, title, level, order_index, content").eq("is_published", true).order("order_index"),
    admin.from("learning_progress").select("module_id, completed, best_score").eq("user_id", user.id),
    admin.from("quiz_attempts").select("module_id, score, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    admin.from("attempts").select("case_id, case_fingerprint, score, duration_seconds, created_at, feedback").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
    admin.from("mastery_scores").select("skill, score, evidence_count, updated_at").eq("user_id", user.id),
    admin.from("generated_cases").select("id, level, skill, sector, fingerprint, status").eq("user_id", user.id).eq("status", "active"),
  ]);

  const modules = ((mods ?? []) as any[]).map((m) => ({ id: m.id as string, title: m.title as string, level: m.level as Level, order_index: m.order_index as number, primary_skill: m.content?.primary_skill as SkillKey | undefined }));
  const completedModuleIds = new Set<string>(((progress ?? []) as any[]).filter((p) => p.completed).map((p) => p.module_id as string));
  const levelModules = modules.filter((m) => m.level === level);
  const moduleIdsAtLevel = new Set(levelModules.map((m) => m.id));
  const caseMap = new Map(((cases ?? []) as any[]).map((c) => [c.id, c]));

  const quizScoresAtLevel = ((quizzes ?? []) as any[]).filter((q) => moduleIdsAtLevel.has(q.module_id)).map((q) => Number(q.score));
  const bestByFingerprint = new Map<string, number>();
  const all = (attempts ?? []) as any[];
  for (const a of all) {
    const c = caseMap.get(a.case_id);
    if (!c || c.level !== level) continue;
    bestByFingerprint.set(a.case_fingerprint, Math.max(bestByFingerprint.get(a.case_fingerprint) ?? 0, Number(a.score)));
  }
  const masteryMap: Partial<Record<SkillKey, number>> = {};
  const masteryUpdated: Partial<Record<SkillKey, string>> = {};
  for (const m of (mastery ?? []) as any[]) {
    masteryMap[m.skill as SkillKey] = Number(m.score);
    masteryUpdated[m.skill as SkillKey] = m.updated_at;
  }

  const evidence: LevelEvidence = {
    level,
    required_modules: levelModules.map((m) => ({ id: m.id, title: m.title, completed: completedModuleIds.has(m.id) })),
    quiz_scores: quizScoresAtLevel,
    unique_case_scores: [...bestByFingerprint.values()],
    mastery: masteryMap,
    recent_case_scores: all.map((a) => Number(a.score)),
  };
  const report = evaluateLevelProgress(evidence);

  let promotedTo: Level | null = null;
  if (report.eligible && report.next_level) {
    const { error } = await admin.from("profiles").update({ level: report.next_level }).eq("id", user.id);
    if (!error) {
      promotedTo = report.next_level;
      await audit(admin, user.id, "level.promote", "profile", user.id, { from: level, to: report.next_level });
      // سجل الترقيات (أساس شهادات إتمام المستوى)
      const { error: histErr } = await admin.from("level_history").upsert({ user_id: user.id, level: report.next_level, achieved_at: new Date().toISOString() }, { onConflict: "user_id,level" });
      if (histErr) console.error("[recommend] level_history upsert failed:", histErr.message);
    }
  }

  const avg = all.length ? Math.round((all.reduce((s, a) => s + Number(a.score), 0) / all.length) * 10) / 10 : 0;
  const { strong, weak, stale } = computeSkillBuckets(masteryMap, masteryUpdated);
  const trainingMinutes = Math.round(all.reduce((s, a) => s + Number(a.duration_seconds ?? 0), 0) / 60);
  const lastActivity = all[0]?.created_at ?? ((quizzes ?? []) as any[])[0]?.created_at ?? null;
  const recurringErrors = collectRecurringErrors(all.map((a) => (a.feedback?.gaps ?? []) as string[]));

  const next = decideNext({
    level: promotedTo ?? level,
    report,
    modules,
    completedModuleIds,
    masteryMap,
    staleSkills: stale,
    weakSkills: weak,
    preferredSector: user.preferred_sector as SectorKey | null,
    track: user.track,
    caseSectors: ((cases ?? []) as any[]).map((c) => c.sector as string),
  });

  let weekly: WeeklyPlanItem[];
  let development: string[];
  let focus: string;
  let aiPlan = false;
  const cfg = await resolveAIConfig(admin);
  if (cfg) {
    try {
      const provider = createProvider(cfg);
      const prompt = await loadPrompt(admin, "adaptive-recommendation-prompt");
      const system = renderPrompt(prompt.content, {
        level_label: LEVEL_LABELS[promotedTo ?? level],
        avg_score: avg,
        strong_skills: strong.map((s) => SKILL_LABELS[s].ar).join("، ") || "لا يوجد بعد",
        weak_skills: weak.map((s) => SKILL_LABELS[s].ar).join("، ") || "لا يوجد بعد",
        recurring_errors: recurringErrors.join(" | ") || "لا يوجد",
        stale_skills: stale.slice(0, 4).map((s) => SKILL_LABELS[s].ar).join("، ") || "لا يوجد",
        unmet_requirements: report.requirements.filter((r) => !r.met).map((r) => `${r.label} (${r.detail})`).join("، ") || "لا يوجد",
        regression: report.regression_detected ? "نعم" : "لا",
      });
      const started = Date.now();
      const r = await callStructured(provider, { system, user: "أنشئ الخطة الأسبوعية الآن.", schema: RECOMMENDATION_RESPONSE_SCHEMA, zod: RecommendationModelOutputSchema, temperature: 0.4, maxOutputTokens: 2048 });
      await recordMetric(admin, { kind: "recommend", prompt_version: prompt.version, model: cfg.model, json_valid: r.json_valid_first_try, repaired: r.repaired, regenerated: r.regenerated, latency_ms: Date.now() - started, user_id: user.id });
      weekly = r.data.weekly_plan;
      development = r.data.development_plan;
      focus = r.data.focus_message;
      aiPlan = true;
    } catch (err) {
      console.error("[recommend] ai plan failed, falling back:", err instanceof Error ? err.message : "");
      ({ weekly, development, focus } = deterministicPlan(weak, stale, strong, report));
    }
  } else {
    ({ weekly, development, focus } = deterministicPlan(weak, stale, strong, report));
  }

  return {
    level_report: report,
    promoted_to: promotedTo,
    next,
    weekly_plan: weekly,
    development_plan: development,
    focus_message: focus,
    stats: {
      avg_score: avg,
      cases_total: all.length,
      cases_unique: new Set(all.map((a) => a.case_fingerprint)).size,
      strong_skills: strong,
      weak_skills: weak,
      stale_skills: stale,
      last_activity_at: lastActivity,
      training_minutes: trainingMinutes,
    },
    ai_plan: aiPlan,
  };
}
