// ============================================================
// قواعد الانتقال بين المستويات (لا انتقال تلقائي بسبب اختبار واحد)
// ============================================================
import { LEVELS, LEVEL_LABELS, LEVEL_ORDER, SKILL_LABELS, type Level, type LevelProgressReport, type SkillKey } from "./types.ts";
import { detectRegression } from "./mastery.ts";

export const PASS_SCORE = 70;
export const REQUIRED_PASSING_QUIZZES = 3;
export const REQUIRED_PASSING_CASES = 3;
export const SKILL_MIN_MASTERY = 60;

// المهارات الرئيسة المطلوبة لكل مستوى (حد أدنى في كل منها قبل الانتقال)
export const LEVEL_CORE_SKILLS: Record<Level, SkillKey[]> = {
  beginner: ["problem_definition", "structuring", "quantitative"],
  intermediate: ["structuring", "hypotheses", "data_identification", "root_cause", "prioritization"],
  expert: ["prioritization", "portfolio_evaluation", "risk_governance", "communication"],
  advanced_expert: ["portfolio_evaluation", "risk_governance", "communication", "case_interview", "execution_planning"],
};

export function nextLevel(level: Level): Level | null {
  const i = LEVEL_ORDER[level];
  return i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}

export interface LevelEvidence {
  level: Level;
  /** الوحدات المطلوبة للمستوى الحالي مع حالة إكمالها */
  required_modules: { id: string; title: string; completed: boolean }[];
  /** درجات اختبارات المستوى الحالي (الأحدث أولًا) */
  quiz_scores: number[];
  /** درجات الحالات غير المكررة في المستوى الحالي (الأحدث أولًا) */
  unique_case_scores: number[];
  /** درجات الإتقان الحالية */
  mastery: Partial<Record<SkillKey, number>>;
  /** آخر الدرجات الكلية للحالات (الأحدث أولًا) لاكتشاف التراجع */
  recent_case_scores: number[];
}

export function evaluateLevelProgress(ev: LevelEvidence): LevelProgressReport {
  const next = nextLevel(ev.level);
  const requirements: LevelProgressReport["requirements"] = [];

  const modulesDone = ev.required_modules.filter((m) => m.completed).length;
  requirements.push({
    key: "modules",
    label: "إكمال وحدات المستوى",
    met: ev.required_modules.length > 0 && modulesDone === ev.required_modules.length,
    detail: `${modulesDone} من ${ev.required_modules.length} وحدة`,
  });

  const passingQuizzes = ev.quiz_scores.filter((s) => s >= PASS_SCORE).length;
  requirements.push({
    key: "quizzes",
    label: `${REQUIRED_PASSING_QUIZZES} اختبارات بنسبة ${PASS_SCORE}% فأكثر`,
    met: passingQuizzes >= REQUIRED_PASSING_QUIZZES,
    detail: `${passingQuizzes} من ${REQUIRED_PASSING_QUIZZES}`,
  });

  const passingCases = ev.unique_case_scores.filter((s) => s >= PASS_SCORE).length;
  requirements.push({
    key: "cases",
    label: `${REQUIRED_PASSING_CASES} حالات غير مكررة بنسبة ${PASS_SCORE}% فأكثر`,
    met: passingCases >= REQUIRED_PASSING_CASES,
    detail: `${passingCases} من ${REQUIRED_PASSING_CASES}`,
  });

  for (const skill of LEVEL_CORE_SKILLS[ev.level]) {
    const score = ev.mastery[skill] ?? 0;
    requirements.push({
      key: `skill:${skill}`,
      label: `حد أدنى ${SKILL_MIN_MASTERY} في ${SKILL_LABELS[skill].ar}`,
      met: score >= SKILL_MIN_MASTERY,
      detail: `${Math.round(score)} / 100`,
    });
  }

  const regression = detectRegression(ev.recent_case_scores);
  const eligible = next !== null && requirements.every((r) => r.met);
  return {
    current_level: ev.level,
    next_level: next,
    eligible,
    requirements,
    regression_detected: regression,
  };
}

export function levelLabel(level: Level): string {
  return LEVEL_LABELS[level];
}

/** المستوى المناسب لتوليد الحالات: المستوى الحالي، أو أعلى بدرجة عند اقتراب الأهلية */
export function suggestedCaseLevel(level: Level, report: LevelProgressReport): Level {
  const met = report.requirements.filter((r) => r.met).length;
  const total = report.requirements.length;
  if (report.next_level && total > 0 && met / total >= 0.8 && !report.regression_detected) return report.next_level;
  return level;
}
