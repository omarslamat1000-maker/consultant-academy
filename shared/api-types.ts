// ============================================================
// أنواع استجابات API المشتركة بين الخادم والواجهة
// ============================================================
import type { QuizResult } from "./quiz-grader.ts";
import type { CasePublicView, EvaluationResult, Level, LevelProgressReport, NextRecommendation, SkillKey, WeeklyPlanItem } from "./types.ts";

export interface GenerateOutcome {
  case: CasePublicView;
  attempts: number;
  duplicates_rejected: number;
  ai: boolean;
  message?: string;
}

export interface EvaluateOutcome {
  attempt_id: string;
  evaluation: EvaluationResult;
  mastery_updates: { skill: SkillKey; score: number; evidence_count: number }[];
}

export interface FollowUpOutcome {
  assessment: string;
  score_delta: number;
  next_question: string | null;
  question_focus: string;
  pressure_level: "low" | "medium" | "high";
  is_final: boolean;
  hint: string;
  ai: boolean;
}

export interface QuizOutcome {
  result: QuizResult;
  applied_case_score: number | null;
  applied_case_min: number;
  quiz_min: number;
  best_score: number;
  attempts_count: number;
  completed: boolean;
  passed: boolean;
  mastery: { skill: SkillKey; score: number; evidence_count: number } | null;
}

export interface RecommendationBundle {
  level_report: LevelProgressReport;
  promoted_to: Level | null;
  next: NextRecommendation;
  weekly_plan: WeeklyPlanItem[];
  development_plan: string[];
  focus_message: string;
  stats: {
    avg_score: number;
    cases_total: number;
    cases_unique: number;
    strong_skills: SkillKey[];
    weak_skills: SkillKey[];
    stale_skills: SkillKey[];
    last_activity_at: string | null;
    training_minutes: number;
  };
  ai_plan: boolean;
  /** حُسبت في الواجهة لتعذر الوصول إلى الوظائف الخادمية (بلا ترقية ولا خطة ذكية) */
  computed_locally?: boolean;
}

export interface RevealOutcome {
  key: string;
  label: string;
  value: string;
  unit: string | null;
}

export interface AiStatusPublic {
  configured: boolean;
}
