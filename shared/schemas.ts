// ============================================================
// مخططات التحقق (Zod) للمدخلات والمخرجات — تُستخدم خادميًا وفي الواجهة
// ============================================================
import { z } from "zod";
import {
  CASE_TYPES,
  DECISION_TYPES,
  DIMENSIONS,
  LEVELS,
  PROBLEM_TYPES,
  QUESTION_TYPES,
  SECTORS,
  SKILLS,
} from "./types.ts";

export const LevelSchema = z.enum(LEVELS);
export const SkillSchema = z.enum(SKILLS);
export const SectorSchema = z.enum(SECTORS);
export const CaseTypeSchema = z.enum(CASE_TYPES);
export const ProblemTypeSchema = z.enum(PROBLEM_TYPES);
export const DecisionTypeSchema = z.enum(DECISION_TYPES);
export const QuestionTypeSchema = z.enum(QUESTION_TYPES);

const shortText = z.string().trim().min(1).max(400);
const mediumText = z.string().trim().min(1).max(2500);
const longText = z.string().trim().min(1).max(8000);

export const CaseDataItemSchema = z.object({
  label: shortText,
  value: shortText,
  unit: z.string().max(60).optional(),
  note: z.string().max(400).optional(),
});

export const HiddenDataItemSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: shortText,
  value: shortText,
  unit: z.string().max(60).optional(),
  unlock_hint: z.string().max(300),
});

export const RequiredCalculationSchema = z.object({
  label: shortText,
  method: mediumText,
  expected_result: shortText,
});

export const CaseRubricEntrySchema = z.object({
  dimension: z.enum(DIMENSIONS),
  criteria: z.array(z.string().max(400)).min(1).max(8),
});

// محتوى الحالة الكامل كما يعيده النموذج (يُتحقق منه قبل الحفظ)
export const CaseContentSchema = z.object({
  library_id: z.string().max(40).optional(),
  title: z.string().trim().min(5).max(160),
  sector: SectorSchema,
  level: LevelSchema,
  skill: SkillSchema,
  case_type: CaseTypeSchema,
  problem_type: ProblemTypeSchema,
  decision_type: DecisionTypeSchema,
  context: longText,
  client: shortText,
  core_problem: mediumText,
  decision_required: mediumText,
  objectives: z.array(z.string().max(400)).min(1).max(8),
  constraints: z.array(z.string().max(400)).min(1).max(10),
  available_data: z.array(CaseDataItemSchema).min(3).max(25),
  hidden_data: z.array(HiddenDataItemSchema).max(12).default([]),
  assumptions: z.array(z.string().max(400)).max(10).default([]),
  required_calculations: z.array(RequiredCalculationSchema).min(1).max(10),
  tradeoffs: z.array(z.string().max(500)).min(1).max(8),
  risks: z.array(z.string().max(500)).min(1).max(10),
  internal_solution_logic: longText,
  model_answer: longText,
  rubric: z.array(CaseRubricEntrySchema).min(1).max(7),
  key_numbers: z.array(z.number()).max(40).default([]),
  suggested_time_minutes: z.number().int().min(5).max(120),
  interviewer_questions: z.array(z.string().max(500)).max(10).default([]),
});
export type CaseContentInput = z.input<typeof CaseContentSchema>;

export const DimensionScoresSchema = z.object(
  Object.fromEntries(DIMENSIONS.map((d) => [d, z.number().min(0).max(100)])) as Record<(typeof DIMENSIONS)[number], z.ZodNumber>,
);

// مخرجات التقييم كما يعيدها النموذج (الدرجة الكلية ومستوى الأداء يُحسبان خادميًا)
export const EvaluationModelOutputSchema = z.object({
  dimension_scores: DimensionScoresSchema,
  strengths: z.array(z.string().max(500)).max(10).default([]),
  errors: z.array(z.string().max(500)).max(12).default([]),
  gaps: z.array(z.string().max(500)).max(12).default([]),
  calculations: z
    .object({
      correct: z.array(z.string().max(400)).max(12).default([]),
      incorrect: z.array(z.object({ claim: z.string().max(400), correction: z.string().max(600) })).max(12).default([]),
    })
    .default({ correct: [], incorrect: [] }),
  missing_assumptions: z.array(z.string().max(400)).max(10).default([]),
  off_topic: z.array(z.string().max(400)).max(10).default([]),
  mece_assessment: z.object({ applied: z.boolean(), comment: z.string().max(600) }),
  recommendation_clarity: z.object({ clear: z.boolean(), comment: z.string().max(600) }),
  model_answer: z.string().max(8000),
  improved_answer: z.string().max(8000),
  targeted_exercise: z.object({ skill: SkillSchema, exercise: z.string().max(1200) }),
  next_case_recommendation: z.object({ skill: SkillSchema, level: LevelSchema, sector: SectorSchema, reason: z.string().max(600) }),
});
export type EvaluationModelOutput = z.infer<typeof EvaluationModelOutputSchema>;

export const FollowUpModelOutputSchema = z.object({
  assessment_of_previous_answer: z.string().max(1500),
  score_delta: z.number().min(-15).max(15),
  next_question: z.string().max(800),
  question_focus: z.enum(DIMENSIONS),
  pressure_level: z.enum(["low", "medium", "high"]),
  is_final: z.boolean(),
  hint_if_stuck: z.string().max(500).default(""),
});
export type FollowUpModelOutput = z.infer<typeof FollowUpModelOutputSchema>;

export const RecommendationModelOutputSchema = z.object({
  weekly_plan: z.array(z.object({ day: z.string().max(40), focus: SkillSchema, activity: z.string().max(400) })).min(3).max(7),
  development_plan: z.array(z.string().max(500)).min(2).max(8),
  focus_message: z.string().max(800),
});
export type RecommendationModelOutput = z.infer<typeof RecommendationModelOutputSchema>;

// ---------- طلبات API ----------
export const GenerateCaseRequestSchema = z.object({
  level: LevelSchema.optional(),
  sector: SectorSchema.optional(),
  skill: SkillSchema.optional(),
  case_type: CaseTypeSchema.default("candidate_led"),
  timed: z.boolean().default(false),
  allow_repeat_case_id: z.string().uuid().optional(),
  // بدء حالة محددة من المكتبة الداخلية (مصدر static) بدل التوليد
  library_id: z.string().max(40).optional(),
});
export type GenerateCaseRequest = z.infer<typeof GenerateCaseRequestSchema>;

export const EvaluateRequestSchema = z.object({
  case_id: z.string().uuid(),
  answer_text: z.string().trim().min(20, "الإجابة قصيرة جدًا").max(20000, "الإجابة تتجاوز الحد الأقصى"),
  duration_seconds: z.number().int().min(0).max(24 * 3600).default(0),
  data_requests: z.array(z.string().max(60)).max(12).default([]),
  followup_answers: z.array(z.object({ question: z.string().max(800), answer: z.string().max(4000) })).max(10).default([]),
});
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export const FollowUpRequestSchema = z.object({
  case_id: z.string().uuid(),
  turn_index: z.number().int().min(0).max(10),
  previous_answer: z.string().trim().min(5).max(6000),
  history: z.array(z.object({ question: z.string().max(800), answer: z.string().max(4000) })).max(10).default([]),
});
export type FollowUpRequest = z.infer<typeof FollowUpRequestSchema>;

export const ReviewGradeRequestSchema = z.object({
  card_id: z.string().uuid(),
  answer: z.unknown(),
});
export type ReviewGradeRequest = z.infer<typeof ReviewGradeRequestSchema>;

export const RevealDataRequestSchema = z.object({
  case_id: z.string().uuid(),
  key: z.string().trim().min(1).max(60),
});

export const QuizSubmitRequestSchema = z.object({
  module_id: z.string().uuid(),
  answers: z.record(z.string().max(80), z.unknown()),
  applied_case_answer: z.string().trim().max(12000).optional(),
  duration_seconds: z.number().int().min(0).max(24 * 3600).default(0),
});
export type QuizSubmitRequest = z.infer<typeof QuizSubmitRequestSchema>;

export const ProviderSaveRequestSchema = z.object({
  provider: z.literal("gemini"),
  api_key: z.string().trim().min(20).max(300),
  model: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, "اسم نموذج غير صالح"),
  temperature: z.number().min(0).max(2).default(0.7),
  max_output_tokens: z.number().int().min(256).max(65536).default(8192),
});
export type ProviderSaveRequest = z.infer<typeof ProviderSaveRequestSchema>;

export const ProviderTestRequestSchema = z.object({
  provider: z.literal("gemini"),
  // إن لم يُرسل مفتاح، تُختبر الإعدادات المحفوظة
  api_key: z.string().trim().min(20).max(300).optional(),
  model: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/).optional(),
});

export const ProviderIdRequestSchema = z.object({ id: z.string().uuid() });

export const ProviderRotateRequestSchema = z.object({
  id: z.string().uuid(),
  api_key: z.string().trim().min(20).max(300),
});

export const AdminUsersRequestSchema = z.object({
  action: z.enum(["list", "set_role", "set_level"]),
  user_id: z.string().uuid().optional(),
  role: z.enum(["admin", "learner"]).optional(),
  level: LevelSchema.optional(),
  page: z.number().int().min(1).max(1000).default(1),
});

export const AdminCaseReviewRequestSchema = z.object({
  case_id: z.string().uuid(),
  review_status: z.enum(["pending", "approved", "rejected"]),
  is_reference_example: z.boolean().default(false),
});

export const AdminPromptRequestSchema = z.object({
  action: z.enum(["list", "create", "activate", "deactivate"]),
  id: z.string().uuid().optional(),
  key: z
    .enum([
      "case-generator-system-prompt",
      "case-evaluator-system-prompt",
      "follow-up-interviewer-prompt",
      "adaptive-recommendation-prompt",
      "question-generator-prompt",
    ])
    .optional(),
  version: z.string().max(40).optional(),
  content: z.string().max(60000).optional(),
  notes: z.string().max(1000).optional(),
});

export const ProfileUpdateSchema = z.object({
  display_name: z.string().trim().min(2).max(80).optional(),
  preferred_sector: SectorSchema.nullable().optional(),
});
