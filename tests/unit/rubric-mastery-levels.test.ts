import { describe, expect, it } from "vitest";
import { evaluateLevelProgress, PASS_SCORE, suggestedCaseLevel } from "../../shared/level-rules.ts";
import { detectRegression, masteryFromSeries, masteryUpdatesFromEvaluation, updateMastery } from "../../shared/mastery.ts";
import { assertWeightsSumTo100, computeTotalScore, DIMENSION_WEIGHTS, normalizeDimensionScores, performanceLevel, weakestDimension } from "../../shared/rubric.ts";
import { DIMENSIONS } from "../../shared/types.ts";

describe("Rubric — حساب الدرجات", () => {
  it("الأوزان تجمع إلى 100 وفق المواصفة", () => {
    expect(() => assertWeightsSumTo100()).not.toThrow();
    expect(DIMENSION_WEIGHTS.structure).toBe(20);
    expect(DIMENSION_WEIGHTS.quantitative).toBe(20);
    expect(DIMENSION_WEIGHTS.communication).toBe(15);
  });
  it("الدرجة الكلية مرجّحة بالأوزان وليست متوسطًا بسيطًا", () => {
    const scores = normalizeDimensionScores({ understanding: 100, structure: 100, hypotheses: 0, quantitative: 0, prioritization: 0, risk_governance: 0, communication: 0 });
    expect(computeTotalScore(scores)).toBe(30); // 10 + 20
    const all80 = normalizeDimensionScores(Object.fromEntries(DIMENSIONS.map((d) => [d, 80])));
    expect(computeTotalScore(all80)).toBe(80);
  });
  it("يقصّ القيم خارج النطاق ويتجاهل القيم غير الرقمية", () => {
    const s = normalizeDimensionScores({ understanding: 140, structure: -20, hypotheses: "x" as unknown as number });
    expect(s.understanding).toBe(100);
    expect(s.structure).toBe(0);
    expect(s.hypotheses).toBe(0);
  });
  it("مستوى الأداء وفق العتبات", () => {
    expect(performanceLevel(90)).toBe("expert");
    expect(performanceLevel(70)).toBe("strong");
    expect(performanceLevel(55)).toBe("competent");
    expect(performanceLevel(40)).toBe("developing");
    expect(performanceLevel(10)).toBe("weak");
  });
  it("يحدد أضعف بُعد", () => {
    const s = normalizeDimensionScores({ understanding: 80, structure: 30, hypotheses: 60, quantitative: 70, prioritization: 65, risk_governance: 50, communication: 90 });
    expect(weakestDimension(s)).toBe("structure");
  });
});

describe("Mastery Score المتحرك", () => {
  it("أول محاولة تأخذ الدرجة كما هي", () => {
    expect(updateMastery(null, 62)).toEqual({ score: 62, evidence_count: 1 });
  });
  it("يعطي وزنًا أكبر للمحاولات الحديثة", () => {
    const m = masteryFromSeries([40, 40, 40, 90]);
    expect(m.evidence_count).toBe(4);
    expect(m.score).toBeGreaterThan(55);
    expect(m.score).toBeLessThan(90);
    const older = masteryFromSeries([90, 40, 40, 40]);
    expect(older.score).toBeLessThan(m.score);
  });
  it("يحصر الدرجة بين 0 و100", () => {
    expect(updateMastery(null, 150).score).toBe(100);
    expect(updateMastery(null, -5).score).toBe(0);
  });
  it("يشتق تحديثات مهارات من تقييم حالة", () => {
    const dims = normalizeDimensionScores({ understanding: 50, structure: 60, hypotheses: 70, quantitative: 80, prioritization: 90, risk_governance: 40, communication: 30 });
    const ups = masteryUpdatesFromEvaluation("structuring", 65, dims);
    const struct = ups.find((u) => u.skill === "structuring")!;
    expect(struct.score).toBe(62.5); // متوسط (65 من الحالة + 60 من البُعد)
    expect(ups.find((u) => u.skill === "communication")!.score).toBe(30);
  });
  it("يكتشف التراجع عند هبوط متوسط آخر 3 محاولات بأكثر من 10 نقاط", () => {
    expect(detectRegression([50, 52, 48, 75, 78, 80])).toBe(true);
    expect(detectRegression([75, 78, 80, 50, 52, 48])).toBe(false);
    expect(detectRegression([50, 52])).toBe(false);
  });
});

describe("قواعد الانتقال بين المستويات", () => {
  const base = {
    level: "beginner" as const,
    required_modules: [
      { id: "1", title: "أ", completed: true },
      { id: "2", title: "ب", completed: true },
    ],
    quiz_scores: [80, 75, 90],
    unique_case_scores: [72, 71, 88],
    mastery: { problem_definition: 70, structuring: 65, quantitative: 80 },
    recent_case_scores: [88, 71, 72],
  };
  it("مؤهل عند تحقق جميع الشروط", () => {
    const r = evaluateLevelProgress(base);
    expect(r.eligible).toBe(true);
    expect(r.next_level).toBe("intermediate");
    expect(r.requirements.every((x) => x.met)).toBe(true);
  });
  it("اختبار واحد ناجح لا يكفي", () => {
    const r = evaluateLevelProgress({ ...base, quiz_scores: [95] });
    expect(r.eligible).toBe(false);
    expect(r.requirements.find((x) => x.key === "quizzes")!.met).toBe(false);
  });
  it("الحالات المكررة لا تُحتسب (تمرر درجات فريدة فقط)", () => {
    const r = evaluateLevelProgress({ ...base, unique_case_scores: [80, 85] });
    expect(r.requirements.find((x) => x.key === "cases")!.met).toBe(false);
  });
  it("حد أدنى في كل مهارة رئيسة", () => {
    const r = evaluateLevelProgress({ ...base, mastery: { ...base.mastery, quantitative: 40 } });
    expect(r.eligible).toBe(false);
    expect(r.requirements.find((x) => x.key === "skill:quantitative")!.met).toBe(false);
  });
  it("التراجع لا يخفض المستوى بل يُعلَّم فقط", () => {
    const r = evaluateLevelProgress({ ...base, recent_case_scores: [40, 42, 45, 80, 82, 85] });
    expect(r.regression_detected).toBe(true);
    expect(r.current_level).toBe("beginner");
    expect(suggestedCaseLevel("beginner", r)).toBe("beginner");
  });
  it("أعلى مستوى لا يملك مستوى تاليًا", () => {
    const r = evaluateLevelProgress({ ...base, level: "advanced_expert", mastery: { portfolio_evaluation: 80, risk_governance: 80, communication: 80, case_interview: 80, execution_planning: 80 } });
    expect(r.next_level).toBeNull();
    expect(r.eligible).toBe(false);
  });
  it("عتبة النجاح 70", () => {
    expect(PASS_SCORE).toBe(70);
  });
});
