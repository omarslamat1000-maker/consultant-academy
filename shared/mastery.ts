// ============================================================
// Mastery Score متحرك: يعطي وزنًا أكبر للمحاولات الحديثة (EWMA)
// ============================================================
import type { DimensionKey, DimensionScores, SkillKey } from "./types.ts";

export const MASTERY_ALPHA = 0.35; // وزن المحاولة الجديدة
export const MASTERY_MIN_EVIDENCE = 3; // أقل عدد أدلة قبل اعتبار الدرجة موثوقة

export interface MasteryState {
  score: number;
  evidence_count: number;
}

/**
 * تحديث درجة الإتقان لمهارة بعد محاولة جديدة.
 * أول محاولة تأخذ الدرجة كما هي؛ بعدها EWMA مع وزن alpha للمحاولة الأحدث.
 */
export function updateMastery(prev: MasteryState | null | undefined, newScore: number, alpha = MASTERY_ALPHA): MasteryState {
  const s = Math.min(100, Math.max(0, newScore));
  if (!prev || prev.evidence_count <= 0) return { score: round2(s), evidence_count: 1 };
  // تخفيف أثر التذبذب في الأدلة القليلة: alpha فعّال أعلى قليلًا في البداية
  const effAlpha = prev.evidence_count < MASTERY_MIN_EVIDENCE ? Math.max(alpha, 1 / (prev.evidence_count + 1)) : alpha;
  const next = effAlpha * s + (1 - effAlpha) * prev.score;
  return { score: round2(next), evidence_count: prev.evidence_count + 1 };
}

/** حساب درجة إتقان من سلسلة محاولات مرتبة زمنيًا (الأقدم أولًا) */
export function masteryFromSeries(scores: number[], alpha = MASTERY_ALPHA): MasteryState {
  let state: MasteryState | null = null;
  for (const s of scores) state = updateMastery(state, s, alpha);
  return state ?? { score: 0, evidence_count: 0 };
}

// ربط أبعاد Rubric بالمهارات الرئيسة التي تتأثر بها
export const DIMENSION_TO_SKILLS: Record<DimensionKey, SkillKey[]> = {
  understanding: ["problem_definition"],
  structure: ["structuring"],
  hypotheses: ["hypotheses", "data_identification"],
  quantitative: ["quantitative"],
  prioritization: ["prioritization", "portfolio_evaluation"],
  risk_governance: ["risk_governance", "execution_planning"],
  communication: ["communication", "case_interview"],
};

/**
 * يحوّل تقييم حالة إلى تحديثات مهارات: مهارة الحالة المستهدفة تأخذ الدرجة الكلية،
 * وكل بُعد يغذّي المهارات المرتبطة به.
 */
export function masteryUpdatesFromEvaluation(
  caseSkill: SkillKey,
  total: number,
  dims: DimensionScores,
): { skill: SkillKey; score: number }[] {
  const map = new Map<SkillKey, number[]>();
  const push = (k: SkillKey, v: number) => {
    const arr = map.get(k) ?? [];
    arr.push(v);
    map.set(k, arr);
  };
  push(caseSkill, total);
  for (const d of Object.keys(DIMENSION_TO_SKILLS) as DimensionKey[]) {
    for (const s of DIMENSION_TO_SKILLS[d]) push(s, dims[d]);
  }
  return [...map.entries()].map(([skill, arr]) => ({ skill, score: round2(arr.reduce((a, b) => a + b, 0) / arr.length) }));
}

/** اكتشاف التراجع: متوسط آخر 3 محاولات أقل من متوسط الـ3 التي قبلها بأكثر من 10 نقاط */
export function detectRegression(recentScoresNewestFirst: number[]): boolean {
  if (recentScoresNewestFirst.length < 6) return false;
  const last3 = recentScoresNewestFirst.slice(0, 3);
  const prev3 = recentScoresNewestFirst.slice(3, 6);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return avg(prev3) - avg(last3) > 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
