// ============================================================
// المقيّم المحلي المحدود (حتمي) — يُستخدم في الوضع التجريبي أو عند عدم ربط مزود ذكاء اصطناعي.
// لا يدّعي أنه تقييم ذكاء اصطناعي، ويُعلَّم دائمًا بـ evaluation_type = "local".
// يعتمد على: تغطية عناصر الحالة، الأرقام المستخدمة، بنية الإجابة، وضوح التوصية.
// ============================================================
import { extractNumbers, tokenize } from "./fingerprint.ts";
import { computeTotalScore, performanceLevel, weakestDimension } from "./rubric.ts";
import { SKILL_LABELS, type CaseContent, type DimensionScores, type EvaluationResult, type SkillKey } from "./types.ts";
import { DIMENSION_TO_SKILLS } from "./mastery.ts";

export const LOCAL_EVALUATOR_VERSION = "local-eval-v1";

const RECOMMENDATION_MARKERS = ["اوصي", "توصي", "توصيه", "نوصي", "التوصيه", "يجب", "ينبغي", "اقترح", "نقترح", "القرار", "recommend"];
const STRUCTURE_MARKERS = ["اولا", "ثانيا", "ثالثا", "1", "2", "3", "محور", "فرع", "شجره", "هيكل", "تقسيم", "بعد", "ابعاد"];
const HYPOTHESIS_MARKERS = ["فرضيه", "افترض", "نفترض", "اختبار", "نتحقق", "التحقق", "يثبت", "ينفي", "hypothesis"];
const RISK_MARKERS = ["خطر", "مخاطر", "اعتماديه", "اعتماد", "تصعيد", "حوكمه", "لجنه", "متابعه", "مؤشر", "مالك", "مسؤول"];
const PRIORITY_MARKERS = ["اولويه", "اولويات", "مفاضله", "بديل", "بدائل", "مقارنه", "معيار", "معايير", "ترتيب", "تضحيه", "تاجيل"];

function countMarkers(tokens: Set<string>, rawNormalized: string, markers: string[]): number {
  let n = 0;
  for (const m of markers) if (tokens.has(m) || rawNormalized.includes(m)) n++;
  return n;
}

function coverage(answerTokens: Set<string>, texts: string[]): number {
  const need = new Set<string>();
  for (const t of texts) for (const tok of tokenize(t)) need.add(tok);
  if (need.size === 0) return 0;
  let hit = 0;
  for (const t of need) if (answerTokens.has(t)) hit++;
  return hit / need.size;
}

function scale(x: number, max = 1): number {
  return Math.round(Math.min(100, Math.max(0, (x / max) * 100)));
}

export function localEvaluate(caseContent: CaseContent, answerText: string): EvaluationResult {
  const answer = answerText.trim();
  const tokens = new Set(tokenize(answer));
  const norm = tokenize(answer).join(" ");
  const words = answer.split(/\s+/).filter(Boolean).length;
  const lengthFactor = Math.min(1, words / 180); // إجابة قصيرة جدًا لا تحقق تغطية

  // 1) الفهم: تغطية سؤال القرار والمشكلة الرئيسة
  const understanding = 0.6 * coverage(tokens, [caseContent.core_problem, caseContent.decision_required]) + 0.4 * coverage(tokens, caseContent.objectives);
  // 2) الهيكلة: علامات تنظيم + تغطية القيود والمفاضلات
  const structureMarkers = countMarkers(tokens, norm, STRUCTURE_MARKERS);
  const structure = 0.5 * Math.min(1, structureMarkers / 4) + 0.5 * coverage(tokens, [...caseContent.constraints, ...caseContent.tradeoffs]);
  // 3) الفرضيات
  const hypotheses = 0.6 * Math.min(1, countMarkers(tokens, norm, HYPOTHESIS_MARKERS) / 3) + 0.4 * coverage(tokens, caseContent.assumptions);
  // 4) الكمي: الأرقام المتوقعة التي ظهرت في الإجابة
  const expectedNums = extractNumbers(caseContent.required_calculations.map((r) => r.expected_result));
  const answerNums = new Set(extractNumbers([answer]));
  const caseNums = new Set(extractNumbers(caseContent.available_data.map((d) => d.value)));
  const correctCalcs: string[] = [];
  const incorrectCalcs: { claim: string; correction: string }[] = [];
  for (const rc of caseContent.required_calculations) {
    const exp = extractNumbers([rc.expected_result]);
    const hit = exp.some((e) => [...answerNums].some((a) => Math.abs(a - e) <= Math.abs(e) * 0.03));
    if (hit) correctCalcs.push(rc.label);
    else incorrectCalcs.push({ claim: `لم تظهر نتيجة "${rc.label}" في الإجابة`, correction: `${rc.method} ⇒ ${rc.expected_result}` });
  }
  const usedCaseNums = [...answerNums].filter((n) => caseNums.has(n)).length;
  const quantitative = expectedNums.length === 0
    ? Math.min(1, usedCaseNums / 3)
    : 0.7 * (correctCalcs.length / caseContent.required_calculations.length) + 0.3 * Math.min(1, usedCaseNums / 3);
  // 5) الأولويات والمفاضلات
  const prioritization = 0.5 * Math.min(1, countMarkers(tokens, norm, PRIORITY_MARKERS) / 4) + 0.5 * coverage(tokens, caseContent.tradeoffs);
  // 6) المخاطر والحوكمة
  const risk = 0.5 * Math.min(1, countMarkers(tokens, norm, RISK_MARKERS) / 4) + 0.5 * coverage(tokens, caseContent.risks);
  // 7) التواصل: توصية مبكرة وواضحة + إيجاز
  const firstQuarter = tokenize(answer.slice(0, Math.max(120, Math.floor(answer.length / 4)))).join(" ");
  const recEarly = RECOMMENDATION_MARKERS.some((m) => firstQuarter.includes(m));
  const recAnywhere = RECOMMENDATION_MARKERS.some((m) => norm.includes(m));
  const communication = (recEarly ? 0.6 : recAnywhere ? 0.35 : 0) + (words >= 120 && words <= 700 ? 0.4 : words > 700 ? 0.2 : 0.1);

  const dims: DimensionScores = {
    understanding: scale(understanding * (0.5 + 0.5 * lengthFactor)),
    structure: scale(structure * (0.5 + 0.5 * lengthFactor)),
    hypotheses: scale(hypotheses),
    quantitative: scale(quantitative),
    prioritization: scale(prioritization),
    risk_governance: scale(risk),
    communication: scale(communication),
  };
  const total = computeTotalScore(dims);
  const weakest = weakestDimension(dims);
  const weakestSkill: SkillKey = DIMENSION_TO_SKILLS[weakest][0];

  const strengths: string[] = [];
  const gaps: string[] = [];
  if (dims.understanding >= 60) strengths.push("ربطت إجابتك بسؤال القرار والمشكلة الرئيسة.");
  else gaps.push("لم تُعِد صياغة سؤال القرار بوضوح في بداية الإجابة.");
  if (dims.structure >= 60) strengths.push("الإجابة منظمة في محاور واضحة.");
  else gaps.push("الهيكل غير واضح: قسّم المشكلة إلى فروع لا تتداخل ولا تترك فجوة (MECE).");
  if (dims.quantitative >= 60) strengths.push("استخدمت أرقام الحالة وأجريت الحسابات المطلوبة.");
  else gaps.push("الحسابات المطلوبة لم تكتمل أو لم تظهر نتائجها بوضوح.");
  if (dims.prioritization >= 60) strengths.push("أظهرت مفاضلة صريحة بين البدائل.");
  else gaps.push("لم توضح ما الذي تضحّي به عند اختيار البديل المفضل.");
  if (dims.risk_governance >= 60) strengths.push("تناولت المخاطر وآلية المتابعة.");
  else gaps.push("أضف المخاطر الرئيسة وآلية التصعيد ومالك كل إجراء.");
  if (dims.communication >= 60) strengths.push("التوصية ظهرت مبكرًا وبصياغة تنفيذية.");
  else gaps.push("ابدأ بالتوصية ثم الأسباب ثم الخطوات (Pyramid Principle).");

  const missingAssumptions = caseContent.assumptions.filter((a) => coverage(tokens, [a]) < 0.3);
  const offTopic: string[] = [];
  if (words > 900) offTopic.push("الإجابة مطولة جدًا؛ اختصر ما لا يخدم القرار مباشرة.");

  return {
    total_score: total,
    performance_level: performanceLevel(total),
    dimension_scores: dims,
    strengths,
    errors: incorrectCalcs.map((c) => c.claim),
    gaps,
    calculations: { correct: correctCalcs, incorrect: incorrectCalcs },
    missing_assumptions: missingAssumptions,
    off_topic: offTopic,
    mece_assessment: {
      applied: dims.structure >= 65,
      comment: dims.structure >= 65 ? "يظهر تقسيم منظم دون تداخل واضح." : "التقسيم غير مكتمل أو متداخل؛ راجع فروع شجرة القضايا.",
    },
    recommendation_clarity: {
      clear: recEarly,
      comment: recEarly ? "التوصية واضحة ومبكرة." : recAnywhere ? "التوصية موجودة لكنها متأخرة في النص." : "لا توجد توصية صريحة.",
    },
    model_answer: caseContent.model_answer,
    improved_answer:
      "صياغة مقترحة (بنية فقط — التقييم المحلي لا يعيد كتابة إجابتك): 1) التوصية في سطر واحد مع الرقم الحاسم. 2) ثلاثة أسباب مرتبة بالأهمية مدعومة بحسابات. 3) المفاضلة الصريحة وما يُضحّى به. 4) المخاطر وخطة التخفيف ومالك كل إجراء. 5) الخطوات التالية ومؤشر المتابعة.",
    targeted_exercise: {
      skill: weakestSkill,
      exercise: `تمرين موجه: أعد كتابة الجزء الخاص بـ"${SKILL_LABELS[weakestSkill].ar}" في هذه الحالة خلال 10 دقائق، مع ذكر رقم واحد على الأقل من بيانات الحالة.`,
    },
    next_case_recommendation: {
      skill: weakestSkill,
      level: caseContent.level,
      sector: caseContent.sector,
      reason: `أضعف بُعد في هذه المحاولة هو "${SKILL_LABELS[weakestSkill].ar}"؛ الحالة التالية تركز عليه في المستوى نفسه.`,
    },
    evaluation_type: "local",
    prompt_version: LOCAL_EVALUATOR_VERSION,
  };
}
