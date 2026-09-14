import { describe, expect, it } from "vitest";
import { CURRICULUM } from "../../shared/curriculum/index.ts";
import { gradeQuestion, gradeQuiz, stripAnswers } from "../../shared/quiz-grader.ts";
import { QUESTION_TYPES, type QuizQuestion } from "../../shared/types.ts";

const q = (partial: Partial<QuizQuestion>): QuizQuestion => ({ id: "q", skill: "quantitative", level: "beginner", question_type: "mcq", question: "?", options: [], ...partial });

describe("تصحيح الاختبارات القصيرة", () => {
  it("اختيار من متعدد", () => {
    const qq = q({ options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct_answer: { option: "b" } });
    expect(gradeQuestion(qq, { option: "b" }).correct).toBe(true);
    expect(gradeQuestion(qq, { option: "a" }).correct).toBe(false);
    expect(gradeQuestion(qq, undefined).partial).toBe(0);
  });
  it("حساب رقمي بتسامح", () => {
    const qq = q({ question_type: "numeric", correct_answer: { value: 180.4, tolerance: 0.5 } });
    expect(gradeQuestion(qq, { value: 180 }).correct).toBe(true);
    expect(gradeQuestion(qq, { value: 175 }).correct).toBe(false);
  });
  it("ترتيب الخطوات — درجة جزئية", () => {
    const qq = q({ question_type: "ordering", options: [{ id: "1", text: "" }, { id: "2", text: "" }, { id: "3", text: "" }, { id: "4", text: "" }], correct_answer: { order: ["1", "2", "3", "4"] } });
    expect(gradeQuestion(qq, { order: ["1", "2", "4", "3"] }).partial).toBe(0.5);
    expect(gradeQuestion(qq, { order: ["1", "2", "3", "4"] }).correct).toBe(true);
  });
  it("مطابقة المفاهيم", () => {
    const qq = q({ question_type: "matching", options: { left: [{ id: "l1", text: "" }, { id: "l2", text: "" }], right: [{ id: "r1", text: "" }, { id: "r2", text: "" }] }, correct_answer: { pairs: { l1: "r1", l2: "r2" } } });
    expect(gradeQuestion(qq, { pairs: { l1: "r1", l2: "r1" } }).partial).toBe(0.5);
  });
  it("اختيار متعدد يعاقب الاختيارات الخاطئة", () => {
    const qq = q({ question_type: "most_important_data", correct_answer: { options: ["a", "c"] } });
    expect(gradeQuestion(qq, { options: ["a", "c"] }).correct).toBe(true);
    expect(gradeQuestion(qq, { options: ["a", "b", "c", "d"] }).partial).toBe(0.5);
  });
  it("الإجابة القصيرة بالكلمات المفتاحية وحد أدنى للطول", () => {
    const qq = q({ question_type: "short_answer", correct_answer: { keywords: ["فرضية", "اختبار", "بيان"], min_matches: 2 } });
    const long = "فرضيتي أن التأخر بسبب نقص المعدات واختبار القتل هو سجل المعدات الشهري الذي يكشف الحقيقة كاملة";
    expect(gradeQuestion(qq, { text: long }).correct).toBe(true);
    expect(gradeQuestion(qq, { text: "فرضية" }).correct).toBe(false);
  });
  it("gradeQuiz يحسب النسبة من 100", () => {
    const qs = [q({ id: "1", options: [{ id: "a", text: "" }], correct_answer: { option: "a" } }), q({ id: "2", options: [{ id: "a", text: "" }], correct_answer: { option: "a" } })];
    const r = gradeQuiz(qs, { "1": { option: "a" } });
    expect(r.score).toBe(50);
    expect(r.answered).toBe(1);
  });
  it("stripAnswers يزيل الإجابة الصحيحة والشرح", () => {
    const s = stripAnswers([q({ correct_answer: { option: "a" }, explanation: "x" })]);
    expect(s[0]).not.toHaveProperty("correct_answer");
    expect(s[0]).not.toHaveProperty("explanation");
  });
});

describe("سلامة المنهج المضمَّن", () => {
  it("12 وحدة على الأقل بمعرّفات ثابتة وأسئلة لكل وحدة", () => {
    expect(CURRICULUM.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(CURRICULUM.map((m) => m.id));
    expect(ids.size).toBe(CURRICULUM.length);
    for (const m of CURRICULUM) {
      expect(m.questions.length).toBeGreaterThanOrEqual(5);
      expect(m.content.explanation.length).toBeGreaterThanOrEqual(3);
      expect(m.content.terms.length).toBeGreaterThanOrEqual(4);
      expect(m.content.checklist.length).toBeGreaterThanOrEqual(4);
      expect(m.content.applied_case.model_answer.length).toBeGreaterThan(100);
      expect(m.content.completion_rule.quiz_min_score).toBeGreaterThanOrEqual(70);
    }
  });
  it("كل سؤال له إجابة صحيحة قابلة للتصحيح آليًا والإجابة النموذجية تحقق الدرجة الكاملة", () => {
    for (const m of CURRICULUM) {
      for (const qq of m.questions) {
        expect(qq.correct_answer, `${m.slug}/${qq.id}`).toBeDefined();
        const ca = qq.correct_answer!;
        const modelAnswer = "keywords" in ca ? { text: ca.keywords.join(" ") + " " + "كلمات إضافية لضمان الطول الكافي للإجابة النموذجية في هذا الاختبار" } : (ca as any);
        const g = gradeQuestion(qq, modelAnswer);
        expect(g.correct, `${m.slug}/${qq.question_type}/${qq.id}`).toBe(true);
      }
    }
  });
  it("يغطي المنهج أنواع الأسئلة المدعومة", () => {
    const used = new Set(CURRICULUM.flatMap((m) => m.questions.map((q) => q.question_type)));
    const uncovered = QUESTION_TYPES.filter((t) => !used.has(t));
    expect(uncovered.length).toBeLessThanOrEqual(1);
  });
});
