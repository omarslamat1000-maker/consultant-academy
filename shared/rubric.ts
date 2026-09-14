// ============================================================
// Rubric التقييم الثابت (100 درجة) والدوال المرتبطة به
// ============================================================
import { DIMENSIONS, type DimensionKey, type DimensionScores, type PerformanceLevel } from "./types.ts";

export const RUBRIC_VERSION = "rubric-v1";

// الأوزان بالنسبة المئوية — مجموعها 100
export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  understanding: 10,
  structure: 20,
  hypotheses: 10,
  quantitative: 20,
  prioritization: 15,
  risk_governance: 10,
  communication: 15,
};

export function assertWeightsSumTo100(): void {
  const sum = DIMENSIONS.reduce((s, d) => s + DIMENSION_WEIGHTS[d], 0);
  if (sum !== 100) throw new Error(`Rubric weights must sum to 100, got ${sum}`);
}

export function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

export function normalizeDimensionScores(input: Partial<Record<DimensionKey, unknown>>): DimensionScores {
  const out = {} as DimensionScores;
  for (const d of DIMENSIONS) out[d] = clampScore(input[d]);
  return out;
}

// الدرجة الكلية تُحسب خادميًا دائمًا من درجات الأبعاد (لا نثق بمجموع يعيده النموذج)
export function computeTotalScore(scores: DimensionScores): number {
  let total = 0;
  for (const d of DIMENSIONS) total += (clampScore(scores[d]) * DIMENSION_WEIGHTS[d]) / 100;
  return Math.round(total * 100) / 100;
}

export function performanceLevel(total: number): PerformanceLevel {
  if (total >= 85) return "expert";
  if (total >= 70) return "strong";
  if (total >= 55) return "competent";
  if (total >= 40) return "developing";
  return "weak";
}

export function weakestDimension(scores: DimensionScores): DimensionKey {
  let weakest: DimensionKey = DIMENSIONS[0];
  for (const d of DIMENSIONS) if (scores[d] < scores[weakest]) weakest = d;
  return weakest;
}

export function strongestDimension(scores: DimensionScores): DimensionKey {
  let strongest: DimensionKey = DIMENSIONS[0];
  for (const d of DIMENSIONS) if (scores[d] > scores[strongest]) strongest = d;
  return strongest;
}

// وصف كل بُعد كما يُعرض داخل Prompt التقييم (ثابت لضمان اتساق التقييم)
export const DIMENSION_RUBRIC_TEXT: Record<DimensionKey, { high: string; mid: string; low: string }> = {
  understanding: {
    high: "أعاد صياغة المشكلة وسؤال القرار بدقة، وحدد الهدف والقيود والجهة المعنية، وميّز بين العرض والسبب.",
    mid: "فهم عام للمشكلة مع غموض في سؤال القرار أو إغفال قيد جوهري.",
    low: "أساء فهم المشكلة أو أجاب عن سؤال مختلف عن سؤال القرار.",
  },
  structure: {
    high: "بنى هيكلًا MECE فعليًا (فروع لا تتداخل ولا تترك فجوة) وربط الفروع بسؤال القرار وحدد الفرع الأهم.",
    mid: "هيكل جزئي مع تداخل بين الفروع أو فجوات واضحة، أو هيكل عام غير مخصص للحالة.",
    low: "لا هيكل، أو مجرد قائمة أفكار عشوائية، أو ذكر كلمة MECE دون تطبيق.",
  },
  hypotheses: {
    high: "صاغ فرضيات محددة قابلة للاختبار مرتبطة بالهيكل، وحدد ما الذي يثبتها أو ينفيها.",
    mid: "فرضيات عامة أو غير قابلة للاختبار، أو لم يربطها بالبيانات المطلوبة.",
    low: "لا فرضيات، أو استنتاجات مسبقة تُقدَّم كحقائق.",
  },
  quantitative: {
    high: "استخدم الأرقام المتاحة بدقة، وأجرى الحسابات المطلوبة بصورة صحيحة، وفسّر معناها للقرار.",
    mid: "حسابات جزئية أو خطأ واحد مؤثر، أو أرقام صحيحة دون تفسير.",
    low: "تجاهل الأرقام أو أخطأ في الحسابات الأساسية أو اخترع أرقامًا.",
  },
  prioritization: {
    high: "قارن البدائل بمعايير واضحة، وأظهر المفاضلة الصريحة (ما الذي يُضحّى به)، ورتب الأولويات بمنطق دفاعي.",
    mid: "رتب الأولويات دون معايير واضحة أو أغفل مفاضلة جوهرية.",
    low: "لا ترتيب للأولويات، أو توصية بفعل كل شيء دون مفاضلة.",
  },
  risk_governance: {
    high: "حدد المخاطر والاعتماديات الحقيقية للحالة، واقترح حوكمة وآلية تصعيد وخطوات تنفيذ واقعية.",
    mid: "ذكر مخاطر عامة دون ربطها بالحالة أو دون إجراءات تخفيف.",
    low: "لا مخاطر ولا اعتبارات تنفيذ، أو مجرد ذكر مصطلح الحوكمة.",
  },
  communication: {
    high: "بدأ بالتوصية (Pyramid Principle)، ثم الأسباب المدعومة بالأرقام، ثم الخطوات التالية، بلغة تنفيذية موجزة.",
    mid: "توصية موجودة لكنها مدفونة في نهاية النص أو غير مدعومة، أو صياغة مطولة.",
    low: "لا توصية واضحة، أو سرد تحليلي بلا خلاصة قابلة للتنفيذ.",
  },
};
