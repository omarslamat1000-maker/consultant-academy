// ============================================================
// اختبارات: وزن الحوار، التكرار المتباعد، مقارنة الأقران، المسارات، الشهادات
// ============================================================
import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "../../shared/demo-cases.ts";
import { applyDialogue, DIALOGUE_WEIGHT, dialogueScore } from "../../shared/dialogue.ts";
import { localEvaluate } from "../../shared/local-evaluator.ts";
import { computeTotalScore } from "../../shared/rubric.ts";
import { intervalForStreak, isDue, isMastered, newCardState, nextReviewState, REVIEW_INTERVALS_DAYS } from "../../shared/review.ts";
import { comparePeers, percentileOf } from "../../shared/peers.ts";
import { isPriorityModule, orderModulesForTrack, pickTrackSector, TRACK_PROFILES } from "../../shared/tracks.ts";
import { decideNext } from "../../shared/recommendation-engine.ts";
import { certificateCode, certificatesFromHistory } from "../../shared/certificates.ts";
import { SKILLS, TRACKS } from "../../shared/types.ts";
import { evaluateLevelProgress } from "../../shared/level-rules.ts";

describe("وزن الحوار في الدرجة النهائية", () => {
  const base = localEvaluate(DEMO_CASES[0], "التوصية: نبدأ بمعالجة السبب الجذري ثم نراجع الجدول. الأسباب: أولًا وثانيًا وثالثًا مع الأرقام. المخاطر والمفاضلة والخطوات التالية موضحة.");

  it("لا يغيّر التقييم بلا أدوار حوار", () => {
    expect(applyDialogue(base, [])).toBe(base);
  });

  it("درجة الحوار من المحاور الذكي تتدرج مع score_delta وتُقصّ داخل 0–100", () => {
    expect(dialogueScore([{ score_delta: 15, ai: true }])).toBe(100);
    expect(dialogueScore([{ score_delta: -15, ai: true }])).toBe(0);
    expect(dialogueScore([{ score_delta: 0, ai: true }])).toBe(50);
    expect(dialogueScore([{ score_delta: 9, ai: true }, { score_delta: -3, ai: true }])).toBe(60);
  });

  it("المتابعة الثابتة تكافئ المشاركة فقط", () => {
    expect(dialogueScore([{ score_delta: 0, ai: false }])).toBe(55);
    expect(dialogueScore(Array.from({ length: 6 }, () => ({ score_delta: 0, ai: false })))).toBe(100);
  });

  it("يدمج الحوار في بُعد التواصل بالوزن المعلن ويعيد حساب الدرجة الكلية", () => {
    const out = applyDialogue(base, [{ score_delta: 15, ai: true }, { score_delta: 15, ai: true }]);
    const expectedComm = Math.round(base.dimension_scores.communication * (1 - DIALOGUE_WEIGHT) + 100 * DIALOGUE_WEIGHT);
    expect(out.dimension_scores.communication).toBe(expectedComm);
    expect(out.total_score).toBe(computeTotalScore(out.dimension_scores));
    expect(out.dialogue_assessment).toMatchObject({ turns: 2, score: 100, weight: DIALOGUE_WEIGHT });
    // الأبعاد الأخرى لا تتأثر
    expect(out.dimension_scores.quantitative).toBe(base.dimension_scores.quantitative);
  });
});

describe("التكرار المتباعد (SM-2 مبسّط)", () => {
  it("الفواصل تتزايد مع السلسلة وتتوقف عند الأقصى", () => {
    expect(REVIEW_INTERVALS_DAYS.map((_, i) => intervalForStreak(i))).toEqual([1, 3, 7, 14, 30]);
    expect(intervalForStreak(99)).toBe(30);
  });

  it("الإجابة الصحيحة تطيل الفاصل والخطأ يعيده إلى الغد", () => {
    const now = new Date("2026-09-16T10:00:00Z");
    const c0 = { ...newCardState(now), id: "x", question_id: "q" };
    expect(isDue(c0, now)).toBe(false);
    expect(isDue(c0, new Date("2026-09-17T10:00:01Z"))).toBe(true);
    const c1 = nextReviewState(c0, true, now);
    expect(c1).toMatchObject({ streak: 1, interval_days: 3, reviews: 1, last_result: true });
    expect(c1.due_at).toBe("2026-09-19T10:00:00.000Z");
    const c2 = nextReviewState({ ...c0, ...c1 }, true, now);
    expect(c2.interval_days).toBe(7);
    const c3 = nextReviewState({ ...c0, ...c2 }, false, now);
    expect(c3).toMatchObject({ streak: 0, interval_days: 1, reviews: 3, last_result: false });
    expect(isMastered({ streak: 4 })).toBe(true);
    expect(isMastered({ streak: 3 })).toBe(false);
  });
});

describe("مقارنة مجهولة بالأقران", () => {
  it("النسبة المئوية = حصة القيم التي لا تتجاوز قيمتي", () => {
    expect(percentileOf([10, 20, 30, 40], 25)).toBe(50);
    expect(percentileOf([10, 20, 30, 40], 40)).toBe(100);
    expect(percentileOf([], 40)).toBe(0);
  });

  it("لا مقارنة بمجموعة أصغر من 3، ولا تُسرَّب معرفات", () => {
    const small = comparePeers([{ user_id: "me", skill: "structuring", score: 80 }, { user_id: "u2", skill: "structuring", score: 60 }], "me");
    expect(small.enough_data).toBe(false);
    expect(small.skills.find((s) => s.skill === "structuring")?.percentile).toBeNull();
    const rows = [
      { user_id: "me", skill: "structuring", score: 80 },
      { user_id: "u2", skill: "structuring", score: 60 },
      { user_id: "u3", skill: "structuring", score: 90 },
      { user_id: "u4", skill: "structuring", score: 70 },
    ];
    const out = comparePeers(rows, "me");
    expect(out.enough_data).toBe(true);
    const st = out.skills.find((s) => s.skill === "structuring")!;
    expect(st.percentile).toBe(67);
    expect(st.median).toBe(75);
    expect(out.overall_percentile).toBe(67);
    expect(JSON.stringify(out)).not.toMatch(/u2|u3|u4/);
    expect(out.skills.length).toBe(SKILLS.length);
  });
});

describe("المسارات المهنية", () => {
  const mods = [
    { id: "a", title: "A", level: "beginner" as const, order_index: 1, primary_skill: "problem_definition" as const },
    { id: "b", title: "B", level: "beginner" as const, order_index: 2, primary_skill: "quantitative" as const },
    { id: "c", title: "C", level: "beginner" as const, order_index: 3, primary_skill: "data_identification" as const },
  ];

  it("يعيد ترتيب الوحدات وفق أولويات المسار مع ثبات الترتيب الأصلي للباقي", () => {
    expect(orderModulesForTrack(mods, null).map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(orderModulesForTrack(mods, "performance_analyst").map((m) => m.id)).toEqual(["c", "b", "a"]);
    expect(orderModulesForTrack(mods, "transformation_consultant").map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(isPriorityModule(mods[1], "performance_analyst")).toBe(true);
    expect(isPriorityModule(mods[1], "pmo_manager")).toBe(false);
  });

  it("يختار أقل قطاعات المسار استخدامًا", () => {
    for (const t of TRACKS) expect(TRACK_PROFILES[t].sectors.length).toBeGreaterThanOrEqual(4);
    const s1 = pickTrackSector("pmo_manager", []);
    expect(TRACK_PROFILES.pmo_manager.sectors).toContain(s1);
    const s2 = pickTrackSector("pmo_manager", [s1, s1]);
    expect(s2).not.toBe(s1);
  });

  it("التوصية التالية تحترم المسار في ترتيب الوحدات والقطاع", () => {
    const report = evaluateLevelProgress({ level: "beginner", required_modules: mods.map((m) => ({ id: m.id, title: m.title, completed: false })), quiz_scores: [], unique_case_scores: [], mastery: {}, recent_case_scores: [] });
    const next = decideNext({ level: "beginner", report, modules: mods, completedModuleIds: new Set(), masteryMap: {}, staleSkills: [], weakSkills: [], preferredSector: null, caseSectors: [], track: "performance_analyst" });
    expect(next.kind).toBe("module");
    expect(next.module_id).toBe("c");
    const done = decideNext({ level: "beginner", report: { ...report, regression_detected: false }, modules: mods, completedModuleIds: new Set(["a", "b", "c"]), masteryMap: {}, staleSkills: [], weakSkills: [], preferredSector: null, caseSectors: [], track: "pmo_manager" });
    expect(done.kind).toBe("case");
    expect(TRACK_PROFILES.pmo_manager.sectors).toContain(done.sector);
  });
});

describe("شهادات إتمام المستوى", () => {
  it("سجل المبتدئ لا يمنح شهادة، والترقيات تمنح شهادة المستوى المُتمّ برمز ثابت", () => {
    const hist = [
      { level: "beginner" as const, achieved_at: "2026-01-01T00:00:00Z" },
      { level: "expert" as const, achieved_at: "2026-08-01T00:00:00Z" },
      { level: "intermediate" as const, achieved_at: "2026-04-01T00:00:00Z" },
    ];
    const certs = certificatesFromHistory("user-1", hist);
    expect(certs.map((c) => c.completed_level)).toEqual(["beginner", "intermediate"]);
    expect(certs[0].code).toBe(certificateCode("user-1", "intermediate", "2026-04-01T00:00:00Z"));
    expect(certs[0].code).toMatch(/^[A-Z0-9]{10}$/);
    expect(certificateCode("user-2", "intermediate", "2026-04-01T00:00:00Z")).not.toBe(certs[0].code);
  });
});
