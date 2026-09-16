// ============================================================
// أكاديمية المستشار — الأنواع المشتركة بين الواجهة والوظائف الخادمية
// ============================================================

export const LEVELS = ["beginner", "intermediate", "expert", "advanced_expert"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  expert: "خبير",
  advanced_expert: "خبير متقدم",
};

export const LEVEL_ORDER: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  expert: 2,
  advanced_expert: 3,
};

export const ROLES = ["admin", "learner"] as const;
export type Role = (typeof ROLES)[number];

// المهارات الاثنتا عشرة الرئيسة (تجمّع المهارات الـ22 المستهدفة في البرنامج)
export const SKILLS = [
  "problem_definition",
  "structuring",
  "hypotheses",
  "data_identification",
  "quantitative",
  "root_cause",
  "prioritization",
  "portfolio_evaluation",
  "risk_governance",
  "communication",
  "case_interview",
  "execution_planning",
] as const;
export type SkillKey = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<SkillKey, { ar: string; en: string }> = {
  problem_definition: { ar: "تعريف المشكلة وسؤال القرار", en: "Problem Definition & Decision Question" },
  structuring: { ar: "الهيكلة وMECE وأشجار القضايا", en: "Structuring, MECE & Issue Trees" },
  hypotheses: { ar: "التفكير القائم على الفرضيات", en: "Hypothesis-Driven Thinking" },
  data_identification: { ar: "تحديد البيانات والتحقق من جودتها", en: "Data Identification & Quality" },
  quantitative: { ar: "التحليل الكمي والحساب الذهني", en: "Quantitative Analysis & Mental Math" },
  root_cause: { ar: "تحليل الأسباب الجذرية والفجوات", en: "Root Cause & Gap Analysis" },
  prioritization: { ar: "الأولويات والمفاضلات والسيناريوهات", en: "Prioritization, Trade-offs & Scenarios" },
  portfolio_evaluation: { ar: "تقييم المحافظ والبرامج والمشاريع وBusiness Case", en: "Portfolio, Program & Project Evaluation" },
  risk_governance: { ar: "المخاطر والاعتماديات والحوكمة", en: "Risk, Dependencies & Governance" },
  communication: { ar: "التوصيات التنفيذية وPyramid Principle", en: "Executive Communication & Pyramid Principle" },
  case_interview: { ar: "مقابلات الحالة والخبرة الشخصية", en: "Case & Personal Experience Interview" },
  execution_planning: { ar: "خطة التنفيذ ومؤشرات المتابعة", en: "Execution Planning & KPIs" },
};

export const SECTORS = [
  "municipal_infrastructure",
  "roads_bridges",
  "stormwater",
  "parks_humanization",
  "lighting_urban_facilities",
  "capital_projects",
  "portfolio_program_management",
  "pmo_p3o",
  "government",
  "strategic_planning",
  "performance_kpis",
  "grc",
  "institutional_transformation",
  "ai_data_analytics",
  "investment_partnerships",
  "urban_development",
  "general_business",
] as const;
export type SectorKey = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<SectorKey, string> = {
  municipal_infrastructure: "البنية التحتية البلدية",
  roads_bridges: "الطرق والجسور",
  stormwater: "تصريف مياه الأمطار",
  parks_humanization: "الحدائق والأنسنة",
  lighting_urban_facilities: "الإنارة والمرافق الحضرية",
  capital_projects: "إدارة المشاريع الرأسمالية",
  portfolio_program_management: "إدارة المحافظ والبرامج",
  pmo_p3o: "PMO وP3O",
  government: "القطاع الحكومي",
  strategic_planning: "التخطيط الاستراتيجي",
  performance_kpis: "إدارة الأداء والمؤشرات",
  grc: "الحوكمة والمخاطر والامتثال",
  institutional_transformation: "التحول المؤسسي",
  ai_data_analytics: "الذكاء الاصطناعي وتحليل البيانات",
  investment_partnerships: "الاستثمار والشراكات المجتمعية",
  urban_development: "التطوير الحضري",
  general_business: "حالات أعمال عامة",
};

export const CASE_TYPES = ["candidate_led", "interviewer_led"] as const;
export type CaseType = (typeof CASE_TYPES)[number];
export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  candidate_led: "يقود المرشح الحالة (Candidate-Led)",
  interviewer_led: "يقود المحاور الحالة (Interviewer-Led)",
};

// أنواع المشكلات والقرارات المستخدمة في البصمة ومنع التكرار
export const PROBLEM_TYPES = [
  "budget_reduction",
  "portfolio_reprioritization",
  "project_delay",
  "cost_overrun",
  "contractor_performance",
  "change_orders",
  "utility_relocation",
  "pmo_design",
  "stage_gate_design",
  "investment_decision_quality",
  "org_merger",
  "agency_restructuring",
  "kpi_system",
  "dashboard_redesign",
  "sla_design",
  "community_partnership",
  "urban_feasibility",
  "beneficiary_impact",
  "spatial_equity",
  "portfolio_risk",
  "sunk_cost",
  "satisfaction_under_constraints",
  "100_day_plan",
  "executive_recommendation",
  "recommendation_defense",
  "profitability",
  "market_entry",
  "operations_improvement",
  "other",
] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export const DECISION_TYPES = [
  "go_no_go",
  "prioritize",
  "allocate_budget",
  "select_option",
  "continue_or_stop",
  "redesign",
  "recover",
  "restructure",
  "negotiate",
  "define_kpis",
  "plan",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

// أبعاد Rubric التقييم (الأوزان في shared/rubric.ts)
export const DIMENSIONS = [
  "understanding",
  "structure",
  "hypotheses",
  "quantitative",
  "prioritization",
  "risk_governance",
  "communication",
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  understanding: "فهم المشكلة وسؤال القرار",
  structure: "هيكلة المشكلة وMECE",
  hypotheses: "جودة الفرضيات",
  quantitative: "التحليل الكمي ودقة الحساب",
  prioritization: "تحديد الأولويات والمفاضلات",
  risk_governance: "المخاطر والحوكمة وقابلية التنفيذ",
  communication: "التواصل التنفيذي وPyramid Principle",
};

export type DimensionScores = Record<DimensionKey, number>;

// ---------- أنواع الأسئلة ----------
export const QUESTION_TYPES = [
  "mcq",
  "true_false",
  "ordering",
  "matching",
  "numeric",
  "table_reading",
  "spot_error",
  "best_issue_tree",
  "best_hypothesis",
  "most_important_data",
  "short_answer",
  "open_analysis",
  "written_recommendation",
  "rewrite_weak_answer",
  "compare_recommendations",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "اختيار من متعدد",
  true_false: "صح أو خطأ مع تفسير",
  ordering: "ترتيب الخطوات",
  matching: "مطابقة المفاهيم",
  numeric: "حساب رقمي",
  table_reading: "قراءة جدول أو رسم",
  spot_error: "اكتشاف الخطأ في التحليل",
  best_issue_tree: "اختيار أفضل شجرة قضايا",
  best_hypothesis: "اختيار الفرضية الأقوى",
  most_important_data: "اختيار البيانات الأكثر أهمية",
  short_answer: "إجابة قصيرة",
  open_analysis: "إجابة تحليلية مفتوحة",
  written_recommendation: "توصية تنفيذية مكتوبة",
  rewrite_weak_answer: "إعادة صياغة إجابة ضعيفة",
  compare_recommendations: "مقارنة توصيتين",
};

export interface QuizOption {
  id: string;
  text: string;
}

// الإجابة الصحيحة حسب النوع:
// mcq/spot_error/best_*: {option: string}
// most_important_data: {options: string[]} (اختيار متعدد)
// true_false: {value: boolean}
// ordering: {order: string[]}
// matching: {pairs: Record<string,string>}
// numeric/table_reading(numeric): {value: number, tolerance?: number}
// short_answer/open_*: {keywords: string[], min_matches: number}
export type CorrectAnswer =
  | { option: string }
  | { options: string[] }
  | { value: boolean }
  | { order: string[] }
  | { pairs: Record<string, string> }
  | { value: number; tolerance?: number }
  | { keywords: string[]; min_matches: number };

export interface QuizQuestion {
  id: string;
  module_id?: string;
  skill: SkillKey;
  level: Level;
  question_type: QuestionType;
  question: string;
  options: QuizOption[] | { left: QuizOption[]; right: QuizOption[] } | { table?: TableData; choices?: QuizOption[] };
  correct_answer?: CorrectAnswer;
  explanation?: string;
}

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
  caption?: string;
}

export type QuizUserAnswer =
  | { option: string }
  | { options: string[] }
  | { value: boolean; explanation?: string }
  | { order: string[] }
  | { pairs: Record<string, string> }
  | { value: number }
  | { text: string };

// ---------- محتوى الوحدة ----------
export interface ModuleTerm {
  ar: string;
  en: string;
  definition: string;
}

export interface ModuleExample {
  title: string;
  situation: string;
  application: string;
  result: string;
}

export interface ModuleContent {
  learning_objective: string;
  explanation: string[]; // فقرات
  terms: ModuleTerm[];
  method_steps: string[];
  example_simple: ModuleExample;
  example_medium: ModuleExample;
  example_advanced: ModuleExample;
  common_mistakes: string[];
  checklist: string[];
  exercise: { prompt: string; guidance: string[] };
  applied_case: { title: string; scenario: string; data: { label: string; value: string }[]; task: string; model_answer: string };
  result_interpretation: { range: string; meaning: string; advice: string }[];
  next_recommendation: string;
  completion_rule: { quiz_min_score: number; applied_case_min_score: number; description: string };
}

export interface ModuleSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: Level;
  order_index: number;
  is_published: boolean;
  primary_skill: SkillKey;
}

export interface ModuleFull extends ModuleSummary {
  content: ModuleContent;
  questions: QuizQuestion[];
}

// ---------- الحالات ----------
export interface CaseDataItem {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface HiddenDataItem {
  key: string;
  label: string;
  value: string;
  unit?: string;
  unlock_hint: string;
}

export interface RequiredCalculation {
  label: string;
  method: string;
  expected_result: string;
}

export interface CaseRubricEntry {
  dimension: DimensionKey;
  criteria: string[];
}

export interface CaseContent {
  /** معرّف ثابت لحالات المكتبة الداخلية (اختياري للحالات المولدة) */
  library_id?: string;
  title: string;
  sector: SectorKey;
  level: Level;
  skill: SkillKey;
  case_type: CaseType;
  problem_type: ProblemType;
  decision_type: DecisionType;
  context: string;
  client: string;
  core_problem: string;
  decision_required: string;
  objectives: string[];
  constraints: string[];
  available_data: CaseDataItem[];
  hidden_data: HiddenDataItem[];
  assumptions: string[];
  required_calculations: RequiredCalculation[];
  tradeoffs: string[];
  risks: string[];
  internal_solution_logic: string;
  model_answer: string;
  rubric: CaseRubricEntry[];
  key_numbers: number[];
  suggested_time_minutes: number;
  interviewer_questions: string[];
}

// النسخة التي تُرسل للمتدرب قبل التقييم (بلا حل ولا إجابة معيارية ولا قيم البيانات المخفية)
export interface CasePublicView {
  id: string;
  fingerprint: string;
  title: string;
  sector: SectorKey;
  level: Level;
  skill: SkillKey;
  case_type: CaseType;
  problem_type: ProblemType;
  decision_type: DecisionType;
  context: string;
  client: string;
  core_problem: string;
  decision_required: string;
  objectives: string[];
  constraints: string[];
  available_data: CaseDataItem[];
  hidden_data_labels: { key: string; label: string }[];
  suggested_time_minutes: number;
  interviewer_questions: string[];
  source: "ai" | "static" | "admin";
  prompt_version: string;
  created_at: string;
  similarity_score: number;
}

export interface CaseRecord {
  id: string;
  user_id: string;
  fingerprint: string;
  semantic_signature: SemanticSignature;
  title: string;
  sector: SectorKey;
  skill: SkillKey;
  level: Level;
  case_type: CaseType;
  content: CaseContent;
  prompt_version: string;
  similarity_score: number;
  status: "active" | "rejected_duplicate";
  review_status: "pending" | "approved" | "rejected";
  is_reference_example: boolean;
  source: "ai" | "static" | "admin";
  last_shown_at: string;
  created_at: string;
}

export interface SemanticSignature {
  sector: SectorKey;
  problem_type: ProblemType;
  decision_type: DecisionType;
  skill: SkillKey;
  level: Level;
  objective_tokens: string[];
  key_numbers: number[];
  title_tokens: string[];
}

// ---------- التقييم ----------
export type PerformanceLevel = "weak" | "developing" | "competent" | "strong" | "expert";
export const PERFORMANCE_LABELS: Record<PerformanceLevel, string> = {
  weak: "ضعيف",
  developing: "في طور التطور",
  competent: "كفء",
  strong: "قوي",
  expert: "خبير",
};

export interface EvaluationResult {
  total_score: number;
  performance_level: PerformanceLevel;
  dimension_scores: DimensionScores;
  strengths: string[];
  errors: string[];
  gaps: string[];
  calculations: { correct: string[]; incorrect: { claim: string; correction: string }[] };
  missing_assumptions: string[];
  off_topic: string[];
  mece_assessment: { applied: boolean; comment: string };
  recommendation_clarity: { clear: boolean; comment: string };
  model_answer: string;
  improved_answer: string;
  targeted_exercise: { skill: SkillKey; exercise: string };
  next_case_recommendation: { skill: SkillKey; level: Level; sector: SectorKey; reason: string };
  evaluation_type: "ai" | "local";
  prompt_version: string;
  /** تقييم حوار المحاور (Interviewer-Led) ووزنه في بُعد التواصل */
  dialogue_assessment?: { turns: number; score: number; weight: number; comment: string };
}

export interface ReviewCardRecord {
  id: string;
  question_id: string;
  due_at: string;
  interval_days: number;
  streak: number;
  reviews: number;
  last_result: boolean | null;
}

export interface LevelHistoryRecord {
  level: Level;
  achieved_at: string;
}

export interface AttemptRecord {
  id: string;
  user_id: string;
  case_id: string | null;
  case_fingerprint: string;
  answer_text: string;
  score: number;
  dimension_scores: DimensionScores;
  feedback: EvaluationResult;
  evaluation_type: "ai" | "local";
  human_score: number | null;
  duration_seconds: number;
  created_at: string;
}

export interface MasteryRecord {
  skill: SkillKey;
  score: number;
  evidence_count: number;
  updated_at: string;
}

export const TRACKS = ["pmo_manager", "performance_analyst", "transformation_consultant"] as const;
export type TrackKey = (typeof TRACKS)[number];
export const TRACK_LABELS: Record<TrackKey, string> = {
  pmo_manager: "مدير مكتب إدارة المشاريع (PMO)",
  performance_analyst: "محلل أداء ومؤشرات",
  transformation_consultant: "مستشار تحول مؤسسي",
};

export interface ProfileRecord {
  id: string;
  display_name: string;
  level: Level;
  preferred_sector: SectorKey | null;
  track?: TrackKey | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressRecord {
  module_id: string;
  best_score: number;
  attempts_count: number;
  completed: boolean;
  last_activity_at: string;
}

export interface QuizAttemptRecord {
  id: string;
  module_id: string;
  score: number;
  created_at: string;
}

// ---------- التوصية التكيفية ----------
export interface NextRecommendation {
  kind: "module" | "case" | "review";
  title: string;
  reason: string;
  skill: SkillKey;
  level: Level;
  sector?: SectorKey;
  module_id?: string;
  case_type?: CaseType;
  timed?: boolean;
}

export interface LevelProgressReport {
  current_level: Level;
  next_level: Level | null;
  eligible: boolean;
  requirements: { key: string; label: string; met: boolean; detail: string }[];
  regression_detected: boolean;
}

export interface WeeklyPlanItem {
  day: string;
  focus: SkillKey;
  activity: string;
}
