// ============================================================
// فهرس قوالب Prompts المُصدَّرة — كل قالب في ملف مستقل مع رقم إصدار
// النسخة النشطة قد تُستبدل من لوحة الإدارة (جدول prompt_templates) مع الاحتفاظ بالإصدار المضمَّن كبديل
// ============================================================
import { CASE_GENERATOR_SYSTEM_PROMPT, CASE_GENERATOR_VERSION } from "./case-generator-system-prompt.ts";
import { CASE_EVALUATOR_SYSTEM_PROMPT, CASE_EVALUATOR_VERSION } from "./case-evaluator-system-prompt.ts";
import { FOLLOW_UP_INTERVIEWER_PROMPT, FOLLOW_UP_VERSION } from "./follow-up-interviewer-prompt.ts";
import { ADAPTIVE_RECOMMENDATION_PROMPT, ADAPTIVE_RECOMMENDATION_VERSION } from "./adaptive-recommendation-prompt.ts";
import { QUESTION_GENERATOR_PROMPT, QUESTION_GENERATOR_VERSION } from "./question-generator-prompt.ts";

export const PROMPT_KEYS = [
  "case-generator-system-prompt",
  "case-evaluator-system-prompt",
  "follow-up-interviewer-prompt",
  "adaptive-recommendation-prompt",
  "question-generator-prompt",
] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export const BUILTIN_PROMPTS: Record<PromptKey, { version: string; content: string }> = {
  "case-generator-system-prompt": { version: CASE_GENERATOR_VERSION, content: CASE_GENERATOR_SYSTEM_PROMPT },
  "case-evaluator-system-prompt": { version: CASE_EVALUATOR_VERSION, content: CASE_EVALUATOR_SYSTEM_PROMPT },
  "follow-up-interviewer-prompt": { version: FOLLOW_UP_VERSION, content: FOLLOW_UP_INTERVIEWER_PROMPT },
  "adaptive-recommendation-prompt": { version: ADAPTIVE_RECOMMENDATION_VERSION, content: ADAPTIVE_RECOMMENDATION_PROMPT },
  "question-generator-prompt": { version: QUESTION_GENERATOR_VERSION, content: QUESTION_GENERATOR_PROMPT },
};

/** استبدال المتغيرات {{name}} داخل القالب. المتغيرات غير المعرّفة تُستبدل بنص فارغ */
export function renderPrompt(template: string, vars: Record<string, string | number | boolean | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** حواجز ضد حقن التعليمات: نضع مدخلات المستخدم داخل وسوم صريحة ونزيل محاولات كسر السياق */
export function fenceUserInput(label: string, text: string): string {
  const cleaned = text
    .replace(/<\/?\s*(system|instruction|prompt|assistant|user)\s*>/gi, "")
    .replace(/```/g, "'''")
    .slice(0, 20000);
  return `<${label}>\n${cleaned}\n</${label}>`;
}
