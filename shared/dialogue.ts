// ============================================================
// تقييم حوار المحاور (Interviewer-Led) ودمجه في الدرجة النهائية بوزن صريح
// الوزن: 20% من بُعد التواصل (أي 3 درجات من 100 لأن وزن التواصل 15)
// ============================================================
import { computeTotalScore, performanceLevel } from "./rubric.ts";
import type { EvaluationResult } from "./types.ts";

export const DIALOGUE_WEIGHT = 0.2;
export const DIALOGUE_VERSION = "dialogue-v1";

export interface DialogueTurn {
  score_delta: number; // −15..15 من المحاور الذكي، 0 في المتابعة الثابتة
  ai: boolean;
}

/** درجة الحوار 0–100: من تقييم المحاور الذكي إن وُجد، وإلا درجة مشاركة (تكافئ الاستمرار في الحوار) */
export function dialogueScore(turns: DialogueTurn[]): number {
  if (turns.length === 0) return 0;
  const ai = turns.filter((t) => t.ai);
  if (ai.length > 0) {
    const mean = ai.reduce((s, t) => s + Math.max(-15, Math.min(15, t.score_delta)), 0) / ai.length;
    return Math.round(Math.max(0, Math.min(100, 50 + (mean / 15) * 50)));
  }
  return Math.min(100, 40 + turns.length * 15);
}

export function dialogueComment(turns: DialogueTurn[], score: number): string {
  const n = turns.length;
  const ai = turns.some((t) => t.ai);
  if (!ai) return `أجبت عن ${n} ${n === 1 ? "سؤال متابعة" : "أسئلة متابعة"}؛ احتُسبت المشاركة في بُعد التواصل (المتابعة الثابتة لا تقيّم مضمون الإجابة).`;
  if (score >= 75) return `حافظت على تماسك الموقف تحت ضغط ${n} ${n === 1 ? "سؤال" : "أسئلة"}؛ الإجابات عززت التوصية بأرقام.`;
  if (score >= 50) return `صمدت في معظم أسئلة المحاور (${n}) لكن بعض الإجابات افتقرت إلى الدليل الرقمي.`;
  return `الحوار كشف ضعفًا في الدفاع عن التوصية عبر ${n} ${n === 1 ? "سؤال" : "أسئلة"}؛ تدرّب على الرد بالأرقام والمفاضلات.`;
}

/** يدمج درجة الحوار في بُعد التواصل ويعيد حساب الدرجة الكلية ومستوى الأداء */
export function applyDialogue(evaluation: EvaluationResult, turns: DialogueTurn[]): EvaluationResult {
  if (turns.length === 0) return evaluation;
  const score = dialogueScore(turns);
  const communication = Math.round(evaluation.dimension_scores.communication * (1 - DIALOGUE_WEIGHT) + score * DIALOGUE_WEIGHT);
  const dimension_scores = { ...evaluation.dimension_scores, communication };
  const total_score = computeTotalScore(dimension_scores);
  return {
    ...evaluation,
    dimension_scores,
    total_score,
    performance_level: performanceLevel(total_score),
    dialogue_assessment: { turns: turns.length, score, weight: DIALOGUE_WEIGHT, comment: dialogueComment(turns, score) },
  };
}
