import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "../../shared/demo-cases.ts";
import { buildSemanticSignature, checkDuplicate, computeFingerprint, extractNumbers, normalizeArabic, similarity, SIMILARITY_REJECT_THRESHOLD, tokenize } from "../../shared/fingerprint.ts";
import type { CaseContent } from "../../shared/types.ts";

describe("تطبيع النص العربي والترميز", () => {
  it("يوحد الألف والتاء المربوطة ويزيل التشكيل", () => {
    expect(normalizeArabic("إدارةُ المشاريعِ")).toBe("اداره المشاريع");
  });
  it("يزيل كلمات التوقف و'ال' التعريف", () => {
    const t = tokenize("في إدارة المشاريع من الأمانة");
    expect(t).toContain("اداره");
    expect(t).toContain("مشاريع");
    expect(t).toContain("امانه");
    expect(t).not.toContain("في");
  });
  it("يستخرج الأرقام العربية واللاتينية", () => {
    expect(extractNumbers(["الاعتماد ٨٢٠ مليون وتخفيض 22%"])).toEqual([22, 820]);
  });
});

describe("البصمة ومنع التكرار", () => {
  const base = DEMO_CASES[0];
  it("البصمة ثابتة لنفس المحتوى", () => {
    const a = computeFingerprint(buildSemanticSignature(base));
    const b = computeFingerprint(buildSemanticSignature({ ...base }));
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
  it("إعادة الصياغة بنفس الأرقام ونوع المشكلة = بصمة متطابقة (مرفوضة)", () => {
    const reworded: CaseContent = { ...base, title: "عنوان مختلف تمامًا", context: "سياق مكتوب بصياغة أخرى " + base.context.slice(0, 40) };
    const sig1 = buildSemanticSignature(base);
    const sig2 = buildSemanticSignature(reworded);
    expect(computeFingerprint(sig2)).toBe(computeFingerprint(sig1));
    const check = checkDuplicate(sig2, computeFingerprint(sig2), [{ fingerprint: computeFingerprint(sig1), signature: sig1 }]);
    expect(check.duplicate).toBe(true);
    expect(check.max_similarity).toBe(1);
  });
  it("حالة بقطاع ونوع مشكلة وأرقام مختلفة لا تُعد مكررة", () => {
    const sigs = DEMO_CASES.map((c) => ({ signature: buildSemanticSignature(c), fingerprint: computeFingerprint(buildSemanticSignature(c)) }));
    for (let i = 0; i < sigs.length; i++) {
      const others = sigs.filter((_, j) => j !== i);
      const r = checkDuplicate(sigs[i].signature, sigs[i].fingerprint, others);
      expect(r.duplicate, `demo case ${i} should be unique`).toBe(false);
    }
  });
  it("تغيير الأرقام مع نفس نوع المشكلة يخفض التشابه دون العتبة عند تغير الأهداف", () => {
    const sigA = buildSemanticSignature(base);
    const variant: CaseContent = {
      ...base,
      sector: "roads_bridges",
      key_numbers: [3.1, 1.2, 9, 24, 0.9],
      objectives: ["تسليم الجسر قبل موسم الحج", "خفض المطالبات"],
      core_problem: "تأخر جسر بسبب نقل خدمات كهرباء",
      decision_required: "هل يُمنح المقاول تمديدًا؟",
      title: "تأخر جسر تقاطع بسبب نقل الخدمات",
    };
    const sigB = buildSemanticSignature(variant);
    const s = similarity(sigA, sigB);
    expect(s.same_problem_type).toBe(true);
    expect(s.score).toBeLessThan(SIMILARITY_REJECT_THRESHOLD);
  });
  it("يقارن مع آخر 100 حالة فقط", () => {
    const sig = buildSemanticSignature(base);
    const fp = computeFingerprint(sig);
    const filler = Array.from({ length: 100 }, (_, i) => ({ fingerprint: `x${i}`, signature: { ...sig, sector: "general_business" as const, problem_type: "other" as const, decision_type: "plan" as const, key_numbers: [i], objective_tokens: [], title_tokens: [] } }));
    const r = checkDuplicate(sig, fp, [...filler, { fingerprint: fp, signature: sig }]);
    expect(r.duplicate).toBe(false);
  });
});
