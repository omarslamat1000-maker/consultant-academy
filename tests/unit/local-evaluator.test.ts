import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "../../shared/demo-cases.ts";
import { localEvaluate } from "../../shared/local-evaluator.ts";
import { coverageScore } from "../../shared/recommendation-engine.ts";
import { tokenize } from "../../shared/fingerprint.ts";

describe("المقيّم المحلي (حتمي، غير ذكي)", () => {
  const c = DEMO_CASES[0];
  it("يعلّم نفسه كتقييم محلي ولا يدّعي الذكاء الاصطناعي", () => {
    const r = localEvaluate(c, "إجابة قصيرة جدًا بلا محتوى.");
    expect(r.evaluation_type).toBe("local");
    expect(r.prompt_version).toMatch(/local/);
  });
  it("الإجابة المعيارية تحقق درجة أعلى بكثير من إجابة فارغة المحتوى", () => {
    const weak = localEvaluate(c, "أعتقد أن المشكلة صعبة ويجب دراستها أكثر وتشكيل لجنة لمتابعة الموضوع.");
    const strong = localEvaluate(c, c.model_answer);
    expect(strong.total_score).toBeGreaterThan(weak.total_score + 25);
    expect(strong.calculations.correct.length).toBeGreaterThan(0);
  });
  it("ذكر المصطلحات بلا أرقام لا يمنح درجة كمية مرتفعة", () => {
    const buzz = localEvaluate(c, "سأستخدم MECE والفرضيات والمخاطر والحوكمة وPyramid Principle لتحليل هذه الحالة بشكل منهجي ومتكامل، وأوصي بمتابعة الموضوع مع الأطراف كافة.");
    expect(buzz.dimension_scores.quantitative).toBeLessThan(40);
  });
  it("نفس المدخلات تعطي نفس المخرجات (حتمية)", () => {
    const a = localEvaluate(c, c.model_answer);
    const b = localEvaluate(c, c.model_answer);
    expect(a.total_score).toBe(b.total_score);
    expect(a.dimension_scores).toEqual(b.dimension_scores);
  });
  it("coverageScore للحالة التطبيقية يكافئ الإجابة النموذجية", () => {
    const full = coverageScore(c.model_answer, c.model_answer, tokenize);
    const none = coverageScore(c.model_answer, "لا أعرف الإجابة عن هذا السؤال إطلاقًا ولا أستطيع تحليله الآن بسبب ضيق الوقت", tokenize);
    expect(full).toBeGreaterThanOrEqual(90);
    expect(none).toBeLessThan(30);
  });
});
