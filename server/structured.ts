// ============================================================
// استدعاء مهيكل مع تحقق JSON: محاولة إصلاح واحدة، ثم إعادة توليد واحدة، ثم فشل صريح
// ============================================================
import type { ZodType } from "zod";
import { ApiError, Errors } from "./respond.ts";
import { ProviderError, type AIProvider, type GeminiSchema } from "./providers/types.ts";

export interface StructuredCallResult<T> {
  data: T;
  json_valid_first_try: boolean;
  repaired: boolean;
  regenerated: boolean;
  latency_ms: number;
  raw_text_length: number;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  // إزالة أسوار الكود إن وُجدت
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first >= 0 && last > first) return body.slice(first, last + 1);
  return body;
}

function tryParse<T>(text: string, zod: ZodType<T>): { ok: true; data: T } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch (e) {
    return { ok: false, reason: `JSON parse error: ${e instanceof Error ? e.message : "unknown"}` };
  }
  const r = zod.safeParse(parsed);
  if (r.success) return { ok: true, data: r.data };
  const issues = r.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return { ok: false, reason: `Schema validation failed: ${issues}` };
}

export async function callStructured<T>(
  provider: AIProvider,
  opts: { system: string; user: string; schema: GeminiSchema; zod: ZodType<T>; temperature?: number; maxOutputTokens?: number; timeoutMs?: number },
): Promise<StructuredCallResult<T>> {
  const started = Date.now();
  let repaired = false;
  let regenerated = false;

  let first: { text: string };
  try {
    first = await provider.generateJSON(opts);
  } catch (err) {
    throw toApiError(err);
  }
  let attempt = tryParse(first.text, opts.zod);
  if (attempt.ok) {
    return { data: attempt.data, json_valid_first_try: true, repaired, regenerated, latency_ms: Date.now() - started, raw_text_length: first.text.length };
  }

  // 1) محاولة إصلاح واحدة: نطلب من النموذج تصحيح JSON ليطابق المخطط دون تغيير المحتوى
  repaired = true;
  try {
    const fix = await provider.generateJSON({
      system: "أنت مصلح JSON. أعد JSON صالحًا فقط مطابقًا للمخطط، مع الحفاظ على المحتوى نفسه وتصحيح الحقول الناقصة أو غير الصالحة.",
      user: `المشكلة: ${attempt.reason}\n\nJSON المطلوب إصلاحه:\n${first.text.slice(0, 60000)}`,
      schema: opts.schema,
      temperature: 0,
      maxOutputTokens: opts.maxOutputTokens,
      timeoutMs: opts.timeoutMs,
    });
    attempt = tryParse(fix.text, opts.zod);
    if (attempt.ok) {
      return { data: attempt.data, json_valid_first_try: false, repaired, regenerated, latency_ms: Date.now() - started, raw_text_length: fix.text.length };
    }
  } catch {
    // نتابع إلى إعادة التوليد
  }

  // 2) إعادة توليد واحدة بدرجة إبداع أقل
  regenerated = true;
  try {
    const again = await provider.generateJSON({ ...opts, temperature: Math.max(0, (opts.temperature ?? 0.7) - 0.3) });
    attempt = tryParse(again.text, opts.zod);
    if (attempt.ok) {
      return { data: attempt.data, json_valid_first_try: false, repaired, regenerated, latency_ms: Date.now() - started, raw_text_length: again.text.length };
    }
    console.error("[structured] regenerate still invalid:", attempt.reason.slice(0, 300));
  } catch (err) {
    throw toApiError(err);
  }
  throw Errors.aiFailed("أعاد المزود استجابة غير صالحة البنية بعد محاولتي إصلاح وإعادة توليد. حاول مرة أخرى.");
}

export function toApiError(err: unknown) {
  if (err instanceof ProviderError) {
    if (err.code === "invalid_key") return new ApiError(503, "ai_invalid_key", "مفتاح Gemini مرفوض أو غير صالح. راجع المفتاح في صفحة «مفتاح API» أو متغير GEMINI_API_KEY.");
    if (err.code === "model_not_found") return new ApiError(503, "ai_model_not_found", "النموذج المحدد غير متاح لهذا المفتاح. اختر gemini-2.5-flash من صفحة «مفتاح API».");
    return Errors.aiFailed(err.message);
  }
  return err;
}
