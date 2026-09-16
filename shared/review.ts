// ============================================================
// التكرار المتباعد (Spaced Repetition) — جدولة مبسطة على نمط SM-2
// تُنشأ بطاقة لكل سؤال أخطأ فيه المتدرب في اختبار وحدة، وتُراجع بفواصل متزايدة عند الإجابة الصحيحة
// ============================================================
import type { ReviewCardRecord } from "./types.ts";

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const REVIEW_VERSION = "review-v1";

export interface ReviewCardState {
  interval_days: number;
  streak: number;
  reviews: number;
  due_at: string;
  last_result: boolean | null;
}

export function intervalForStreak(streak: number): number {
  return REVIEW_INTERVALS_DAYS[Math.min(Math.max(0, streak), REVIEW_INTERVALS_DAYS.length - 1)];
}

export function addDays(iso: string | Date, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** حالة البطاقة الجديدة عند الخطأ في الاختبار (أو إعادة الخطأ) */
export function newCardState(now = new Date()): ReviewCardState {
  return { interval_days: 1, streak: 0, reviews: 0, due_at: addDays(now, 1), last_result: null };
}

/** الانتقال بعد مراجعة: صحيح → السلسلة +1 وفاصل أطول؛ خطأ → تصفير السلسلة ومراجعة غدًا */
export function nextReviewState(card: Pick<ReviewCardRecord, "interval_days" | "streak" | "reviews">, correct: boolean, now = new Date()): ReviewCardState {
  const streak = correct ? card.streak + 1 : 0;
  const interval_days = intervalForStreak(streak);
  return { interval_days, streak, reviews: card.reviews + 1, due_at: addDays(now, interval_days), last_result: correct };
}

export function isDue(card: Pick<ReviewCardRecord, "due_at">, now = new Date()): boolean {
  return new Date(card.due_at).getTime() <= now.getTime();
}

/** بطاقة "متقنة" بعد 4 مراجعات صحيحة متتالية (فاصل 30 يومًا) */
export function isMastered(card: Pick<ReviewCardRecord, "streak">): boolean {
  return card.streak >= REVIEW_INTERVALS_DAYS.length - 1;
}
