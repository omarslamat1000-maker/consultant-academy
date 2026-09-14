// ============================================================
// مخططات الإخراج المهيكل (Structured Output) لواجهة Gemini — مجموعة OpenAPI الفرعية
// تُستخدم مع generationConfig.responseSchema لضمان JSON صالح البنية
// ============================================================
import { CASE_TYPES, DECISION_TYPES, DIMENSIONS, LEVELS, PROBLEM_TYPES, SECTORS, SKILLS } from "./types.ts";

type GSchema = {
  type: "OBJECT" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY";
  description?: string;
  enum?: readonly string[];
  items?: GSchema;
  properties?: Record<string, GSchema>;
  required?: string[];
  nullable?: boolean;
  propertyOrdering?: string[];
};

const str = (description?: string): GSchema => ({ type: "STRING", description });
const num = (description?: string): GSchema => ({ type: "NUMBER", description });
const int = (description?: string): GSchema => ({ type: "INTEGER", description });
const bool = (description?: string): GSchema => ({ type: "BOOLEAN", description });
const arr = (items: GSchema, description?: string): GSchema => ({ type: "ARRAY", items, description });
const obj = (properties: Record<string, GSchema>, required?: string[]): GSchema => ({
  type: "OBJECT",
  properties,
  required: required ?? Object.keys(properties),
  propertyOrdering: Object.keys(properties),
});
const en = (values: readonly string[], description?: string): GSchema => ({ type: "STRING", enum: values, description });

export const CASE_RESPONSE_SCHEMA: GSchema = obj({
  title: str("عنوان الحالة بالعربية"),
  sector: en(SECTORS),
  level: en(LEVELS),
  skill: en(SKILLS),
  case_type: en(CASE_TYPES),
  problem_type: en(PROBLEM_TYPES),
  decision_type: en(DECISION_TYPES),
  context: str("سياق الحالة بالعربية، 150-400 كلمة"),
  client: str("العميل أو الجهة"),
  core_problem: str("المشكلة الرئيسة"),
  decision_required: str("القرار المطلوب بصياغة سؤال قرار"),
  objectives: arr(str()),
  constraints: arr(str()),
  available_data: arr(obj({ label: str(), value: str(), unit: str(), note: str() }, ["label", "value"])),
  hidden_data: arr(obj({ key: str("معرّف لاتيني قصير"), label: str(), value: str(), unit: str(), unlock_hint: str() }, ["key", "label", "value", "unlock_hint"])),
  assumptions: arr(str()),
  required_calculations: arr(obj({ label: str(), method: str(), expected_result: str() })),
  tradeoffs: arr(str()),
  risks: arr(str()),
  internal_solution_logic: str("الحل المنطقي الداخلي خطوة بخطوة"),
  model_answer: str("الإجابة المعيارية الكاملة وفق Pyramid Principle"),
  rubric: arr(obj({ dimension: en(DIMENSIONS), criteria: arr(str()) })),
  key_numbers: arr(num(), "الأرقام الجوهرية في الحالة"),
  suggested_time_minutes: int(),
  interviewer_questions: arr(str(), "أسئلة المحاور المتتابعة (لنمط Interviewer-Led)"),
});

export const EVALUATION_RESPONSE_SCHEMA: GSchema = obj({
  dimension_scores: obj(Object.fromEntries(DIMENSIONS.map((d) => [d, num("0-100")]))),
  strengths: arr(str()),
  errors: arr(str()),
  gaps: arr(str()),
  calculations: obj({ correct: arr(str()), incorrect: arr(obj({ claim: str(), correction: str() })) }),
  missing_assumptions: arr(str()),
  off_topic: arr(str()),
  mece_assessment: obj({ applied: bool(), comment: str() }),
  recommendation_clarity: obj({ clear: bool(), comment: str() }),
  model_answer: str(),
  improved_answer: str(),
  targeted_exercise: obj({ skill: en(SKILLS), exercise: str() }),
  next_case_recommendation: obj({ skill: en(SKILLS), level: en(LEVELS), sector: en(SECTORS), reason: str() }),
});

export const FOLLOW_UP_RESPONSE_SCHEMA: GSchema = obj({
  assessment_of_previous_answer: str(),
  score_delta: num("-15 إلى 15"),
  next_question: str(),
  question_focus: en(DIMENSIONS),
  pressure_level: en(["low", "medium", "high"]),
  is_final: bool(),
  hint_if_stuck: str(),
});

export const RECOMMENDATION_RESPONSE_SCHEMA: GSchema = obj({
  weekly_plan: arr(obj({ day: str(), focus: en(SKILLS), activity: str() })),
  development_plan: arr(str()),
  focus_message: str(),
});

export const TEST_RESPONSE_SCHEMA: GSchema = obj({ ok: bool(), echo: str() });
