// ============================================================
// حدود المعدل — مخزنة في قاعدة البيانات (الوظائف عديمة الحالة)
// ============================================================
import type { AdminClient } from "./supabase-admin.ts";
import { Errors } from "./respond.ts";

export interface RateRule {
  limit: number;
  windowSeconds: number;
}

export const RATE_RULES = {
  generate: { limit: 12, windowSeconds: 600 } satisfies RateRule, // 12 توليد كل 10 دقائق لكل مستخدم
  evaluate: { limit: 20, windowSeconds: 600 } satisfies RateRule,
  follow_up: { limit: 40, windowSeconds: 600 } satisfies RateRule,
  provider_test: { limit: 5, windowSeconds: 300 } satisfies RateRule,
  provider_write: { limit: 10, windowSeconds: 600 } satisfies RateRule,
  quiz: { limit: 30, windowSeconds: 600 } satisfies RateRule,
  recommend: { limit: 30, windowSeconds: 600 } satisfies RateRule,
  admin: { limit: 120, windowSeconds: 600 } satisfies RateRule,
  global_ai: { limit: 300, windowSeconds: 600 } satisfies RateRule, // حد إجمالي لاستدعاءات الذكاء
} as const;

export async function enforceRateLimit(admin: AdminClient, scope: keyof typeof RATE_RULES, subject: string): Promise<void> {
  const rule = RATE_RULES[scope];
  const bucket = `${scope}:${subject}`;
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    // فشل قاعدة البيانات لا يجب أن يفتح الباب؛ نرفض الطلب بأمان
    console.error("[rate-limit] rpc error:", error.message);
    throw Errors.server();
  }
  if (data !== true) throw Errors.rateLimited();
}
