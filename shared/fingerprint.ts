// ============================================================
// بصمة الحالة والتوقيع الدلالي ومقياس التشابه — لمنع تكرار الحالات
// لا يعتمد على العشوائية: يقارن الخصائص البنيوية والأرقام والنصوص
// ============================================================
import type { CaseContent, SemanticSignature } from "./types.ts";

const ARABIC_STOPWORDS = new Set([
  "في", "من", "على", "إلى", "عن", "مع", "أن", "إن", "أو", "و", "ثم", "لا", "ما", "هذا", "هذه", "ذلك", "تلك",
  "التي", "الذي", "الذين", "كان", "كانت", "يكون", "هو", "هي", "هم", "بين", "بعد", "قبل", "عند", "لدى", "حتى",
  "كل", "بعض", "أي", "غير", "دون", "خلال", "حول", "ضمن", "لكن", "بل", "قد", "لم", "لن", "إذا", "كما", "منذ",
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "with", "by", "at", "from", "is", "are",
]);

/** تطبيع النص العربي: إزالة التشكيل، توحيد الألف والتاء المربوطة، إزالة "ال" التعريف */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase();
}

export function tokenize(text: string): string[] {
  const norm = normalizeArabic(text);
  const raw = norm.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  const out: string[] = [];
  for (let t of raw) {
    if (t.startsWith("ال") && t.length > 4) t = t.slice(2);
    if (t.startsWith("و") && t.length > 4) t = t.slice(1);
    if (ARABIC_STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return [...new Set(out)];
}

/** استخراج الأرقام الجوهرية من نصوص الحالة (لكشف إعادة استخدام السيناريو نفسه بأرقام متطابقة) */
export function extractNumbers(texts: string[]): number[] {
  const nums = new Set<number>();
  for (const t of texts) {
    const matches = t.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).match(/\d+(?:[.,]\d+)?/g) ?? [];
    for (const m of matches) {
      const v = Number(m.replace(/,/g, ""));
      if (Number.isFinite(v) && v !== 0) nums.add(Math.round(v * 100) / 100);
    }
  }
  return [...nums].sort((a, b) => a - b);
}

// FNV-1a 64-bit (سريع، متزامن، متوفر في المتصفح والخادم). ليس تشفيريًا وليس مطلوبًا أن يكون
function fnv1a64(str: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

export function stableHash(input: string): string {
  return fnv1a64(input) + fnv1a64(input.split("").reverse().join(""));
}

export function buildSemanticSignature(c: CaseContent): SemanticSignature {
  const keyNumbers = c.key_numbers?.length
    ? [...new Set(c.key_numbers.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b)
    : extractNumbers([...c.available_data.map((d) => d.value), ...c.hidden_data.map((d) => d.value), ...c.required_calculations.map((r) => r.expected_result)]);
  return {
    sector: c.sector,
    problem_type: c.problem_type,
    decision_type: c.decision_type,
    skill: c.skill,
    level: c.level,
    objective_tokens: tokenize([c.core_problem, c.decision_required, ...c.objectives].join(" ")).slice(0, 60),
    key_numbers: keyNumbers.slice(0, 40),
    title_tokens: tokenize(c.title),
  };
}

/** البصمة: هاش للخصائص البنيوية + أهم الأرقام (تكفي لاكتشاف الحالة "نفسها بصياغة مختلفة") */
export function computeFingerprint(sig: SemanticSignature): string {
  const nums = sig.key_numbers.slice(0, 12).join(",");
  const base = [sig.sector, sig.problem_type, sig.decision_type, sig.skill, sig.level, nums].join("|");
  return stableHash(base);
}

function jaccard(a: Iterable<string | number>, b: Iterable<string | number>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface SimilarityBreakdown {
  score: number;
  same_sector: boolean;
  same_problem_type: boolean;
  same_decision_type: boolean;
  numbers_overlap: number;
  objective_overlap: number;
  title_overlap: number;
}

/**
 * درجة تشابه من 0 إلى 1 بين توقيعين دلاليين.
 * أوزان: نوع المشكلة 0.25، القطاع 0.15، نوع القرار 0.10، تداخل الأرقام 0.25، تداخل الأهداف 0.15، تداخل العنوان 0.10
 */
export function similarity(a: SemanticSignature, b: SemanticSignature): SimilarityBreakdown {
  const sameSector = a.sector === b.sector;
  const sameProblem = a.problem_type === b.problem_type;
  const sameDecision = a.decision_type === b.decision_type;
  const numOverlap = jaccard(a.key_numbers, b.key_numbers);
  const objOverlap = jaccard(a.objective_tokens, b.objective_tokens);
  const titleOverlap = jaccard(a.title_tokens, b.title_tokens);
  const score =
    (sameProblem ? 0.25 : 0) +
    (sameSector ? 0.15 : 0) +
    (sameDecision ? 0.1 : 0) +
    0.25 * numOverlap +
    0.15 * objOverlap +
    0.1 * titleOverlap;
  return {
    score: Math.round(score * 1000) / 1000,
    same_sector: sameSector,
    same_problem_type: sameProblem,
    same_decision_type: sameDecision,
    numbers_overlap: numOverlap,
    objective_overlap: objOverlap,
    title_overlap: titleOverlap,
  };
}

export const SIMILARITY_REJECT_THRESHOLD = 0.62;
export const RECENT_CASES_WINDOW = 100;

export interface DuplicateCheck {
  duplicate: boolean;
  max_similarity: number;
  closest_index: number;
  reason: string;
}

/** مقارنة حالة جديدة بآخر N حالة للمستخدم */
export function checkDuplicate(candidate: SemanticSignature, candidateFingerprint: string, previous: { fingerprint: string; signature: SemanticSignature }[]): DuplicateCheck {
  let max = 0;
  let idx = -1;
  let reason = "";
  previous.slice(0, RECENT_CASES_WINDOW).forEach((p, i) => {
    if (p.fingerprint === candidateFingerprint) {
      max = 1;
      idx = i;
      reason = "بصمة متطابقة (نفس القطاع ونوع المشكلة والقرار والأرقام)";
      return;
    }
    const s = similarity(candidate, p.signature);
    if (s.score > max) {
      max = s.score;
      idx = i;
      reason = s.same_problem_type && s.numbers_overlap > 0.5
        ? "نفس نوع المشكلة مع أرقام متطابقة إلى حد كبير"
        : s.same_problem_type && s.same_sector
          ? "نفس القطاع ونوع المشكلة مع تداخل في الأهداف"
          : "تداخل مرتفع في الأهداف والأرقام";
    }
  });
  return { duplicate: max >= SIMILARITY_REJECT_THRESHOLD, max_similarity: max, closest_index: idx, reason: max >= SIMILARITY_REJECT_THRESHOLD ? reason : "" };
}
