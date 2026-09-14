// ============================================================
// تصحيح أسئلة الاختبارات القصيرة (حتمي — لا يدّعي أنه تقييم ذكاء اصطناعي)
// ============================================================
import { normalizeArabic, tokenize } from "./fingerprint.ts";
import type { CorrectAnswer, QuizQuestion, QuizUserAnswer } from "./types.ts";

export interface GradedAnswer {
  question_id: string;
  correct: boolean;
  partial: number; // 0..1
  explanation: string;
  expected_summary: string;
}

export interface QuizResult {
  score: number; // 0..100
  graded: GradedAnswer[];
  answered: number;
  total: number;
}

export function gradeQuestion(q: QuizQuestion, answer: QuizUserAnswer | undefined): GradedAnswer {
  const ca = q.correct_answer;
  const base: GradedAnswer = {
    question_id: q.id,
    correct: false,
    partial: 0,
    explanation: q.explanation ?? "",
    expected_summary: describeExpected(q, ca),
  };
  if (!ca || !answer) return base;

  switch (q.question_type) {
    case "mcq":
    case "spot_error":
    case "best_issue_tree":
    case "best_hypothesis":
    case "table_reading": {
      if ("option" in ca && "option" in answer) {
        const ok = answer.option === ca.option;
        return { ...base, correct: ok, partial: ok ? 1 : 0 };
      }
      if ("value" in ca && typeof ca.value === "number" && "value" in answer && typeof answer.value === "number") {
        return gradeNumeric(base, ca.value, (ca as { tolerance?: number }).tolerance, answer.value);
      }
      return base;
    }
    case "most_important_data": {
      if ("options" in ca && "options" in answer) {
        const expected = new Set(ca.options);
        const given = new Set(answer.options);
        let hits = 0;
        for (const g of given) if (expected.has(g)) hits++;
        const wrong = given.size - hits;
        const partial = expected.size === 0 ? 0 : Math.max(0, (hits - wrong * 0.5) / expected.size);
        return { ...base, correct: partial >= 0.999, partial: Math.min(1, partial) };
      }
      return base;
    }
    case "true_false": {
      if ("value" in ca && typeof ca.value === "boolean" && "value" in answer && typeof answer.value === "boolean") {
        const ok = answer.value === ca.value;
        return { ...base, correct: ok, partial: ok ? 1 : 0 };
      }
      return base;
    }
    case "ordering": {
      if ("order" in ca && "order" in answer) {
        const exp = ca.order;
        const got = answer.order;
        if (exp.length === 0) return base;
        let inPlace = 0;
        for (let i = 0; i < exp.length; i++) if (got[i] === exp[i]) inPlace++;
        const partial = inPlace / exp.length;
        return { ...base, correct: partial === 1, partial };
      }
      return base;
    }
    case "matching": {
      if ("pairs" in ca && "pairs" in answer) {
        const keys = Object.keys(ca.pairs);
        if (keys.length === 0) return base;
        let hits = 0;
        for (const k of keys) if (answer.pairs[k] === ca.pairs[k]) hits++;
        const partial = hits / keys.length;
        return { ...base, correct: partial === 1, partial };
      }
      return base;
    }
    case "numeric": {
      if ("value" in ca && typeof ca.value === "number" && "value" in answer && typeof answer.value === "number") {
        return gradeNumeric(base, ca.value, (ca as { tolerance?: number }).tolerance, answer.value);
      }
      return base;
    }
    case "short_answer":
    case "open_analysis":
    case "written_recommendation":
    case "rewrite_weak_answer":
    case "compare_recommendations": {
      if ("keywords" in ca && "text" in answer) {
        const tokens = tokenize(answer.text);
        const norm = normalizeArabic(answer.text);
        let matched = 0;
        for (const kw of ca.keywords) {
          if (keywordMatches(kw, tokens, norm)) matched++;
        }
        const need = Math.max(1, ca.min_matches);
        const partial = Math.min(1, matched / need);
        const lengthOk = answer.text.trim().length >= 40;
        return {
          ...base,
          correct: partial >= 1 && lengthOk,
          partial: lengthOk ? partial : partial * 0.5,
          explanation: `${base.explanation}\n(تصحيح حتمي بالكلمات المفتاحية: ${matched} من ${need} مطلوبة)`.trim(),
        };
      }
      return base;
    }
    default:
      return base;
  }
}

/** مطابقة كلمة مفتاحية عربية بمرونة صرفية: تطابق تام أو جذر مشترك (بادئة ≥ 4 أحرف)، أو احتواء نصي للرموز والكلمات القصيرة */
export function keywordMatches(keyword: string, answerTokens: string[], normalizedAnswer: string): boolean {
  const kwTokens = tokenize(keyword);
  if (kwTokens.length === 0) {
    const raw = normalizeArabic(keyword).trim();
    return raw.length > 0 && normalizedAnswer.includes(raw);
  }
  return kwTokens.every((kt) =>
    answerTokens.some((at) => {
      if (at === kt) return true;
      const n = Math.min(at.length, kt.length);
      if (n < 4) return false;
      let common = 0;
      while (common < n && at[common] === kt[common]) common++;
      return common >= 4 && common >= Math.min(at.length, kt.length) - 2;
    }),
  );
}

function gradeNumeric(base: GradedAnswer, expected: number, tolerance: number | undefined, got: number): GradedAnswer {
  const tol = tolerance ?? Math.abs(expected) * 0.02;
  const ok = Math.abs(got - expected) <= tol;
  return { ...base, correct: ok, partial: ok ? 1 : 0 };
}

export function gradeQuiz(questions: QuizQuestion[], answers: Record<string, QuizUserAnswer>): QuizResult {
  const graded = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const total = questions.length;
  const sum = graded.reduce((s, g) => s + g.partial, 0);
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  return { score: total === 0 ? 0 : Math.round((sum / total) * 10000) / 100, graded, answered, total };
}

function describeExpected(q: QuizQuestion, ca: CorrectAnswer | undefined): string {
  if (!ca) return "";
  if ("option" in ca) {
    const opts = Array.isArray(q.options) ? q.options : "choices" in q.options ? (q.options.choices ?? []) : [];
    const found = opts.find((o) => o.id === ca.option);
    return found ? found.text : ca.option;
  }
  if ("options" in ca) return ca.options.join("، ");
  if ("value" in ca && typeof ca.value === "boolean") return ca.value ? "صحيح" : "خطأ";
  if ("value" in ca && typeof ca.value === "number") return String(ca.value);
  if ("order" in ca) return ca.order.join(" ← ");
  if ("pairs" in ca) return Object.entries(ca.pairs).map(([k, v]) => `${k} ↔ ${v}`).join("، ");
  if ("keywords" in ca) return `عناصر متوقعة: ${ca.keywords.join("، ")}`;
  return "";
}

/** إزالة الإجابة الصحيحة والشرح قبل الإرسال إلى المتدرب */
export function stripAnswers(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => {
    const { correct_answer: _ca, explanation: _ex, ...rest } = q;
    void _ca;
    void _ex;
    return rest;
  });
}
