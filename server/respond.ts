// ============================================================
// أدوات الاستجابة والأخطاء الآمنة للوظائف الخادمية
// ============================================================
import { redactSecrets } from "./crypto.ts";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, messageAr: string) {
    super(messageAr);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: () => new ApiError(401, "unauthorized", "يلزم تسجيل الدخول للوصول إلى هذه الخدمة."),
  forbidden: () => new ApiError(403, "forbidden", "لا تملك صلاحية تنفيذ هذه العملية."),
  badRequest: (msg = "الطلب غير صالح.") => new ApiError(400, "bad_request", msg),
  payloadTooLarge: () => new ApiError(413, "payload_too_large", "حجم الطلب يتجاوز الحد المسموح."),
  rateLimited: () => new ApiError(429, "rate_limited", "تجاوزت الحد المسموح من الطلبات. حاول بعد قليل."),
  notFound: (what = "العنصر") => new ApiError(404, "not_found", `${what} غير موجود.`),
  methodNotAllowed: () => new ApiError(405, "method_not_allowed", "الطريقة غير مدعومة."),
  aiNotConfigured: () => new ApiError(503, "ai_not_configured", "لم يُربط مزود الذكاء الاصطناعي بعد. تواصل مع مسؤول النظام."),
  aiFailed: (msg = "تعذر الحصول على استجابة صالحة من مزود الذكاء الاصطناعي. حاول مرة أخرى.") => new ApiError(502, "ai_failed", msg),
  encryptionNotConfigured: () =>
    new ApiError(503, "encryption_not_configured", "مفتاح التشفير الرئيس غير مضبوط على الخادم. استخدم متغيرات بيئة Netlify أو اضبط CONFIG_ENCRYPTION_KEY."),
  server: () => new ApiError(500, "server_error", "حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا."),
};

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = process.env.ALLOWED_ORIGIN?.trim();
  const origin = req.headers.get("origin") ?? "";
  if (!allowed) return {};
  if (allowed === "*" || origin === allowed) {
    return {
      "Access-Control-Allow-Origin": allowed === "*" ? "*" : origin,
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      Vary: "Origin",
    };
  }
  return {};
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...extra } });
}

export function errorResponse(err: unknown, extra: Record<string, string> = {}): Response {
  if (err instanceof ApiError) {
    return json({ error: { code: err.code, message: err.message } }, err.status, extra);
  }
  // لا تُعرض تفاصيل داخلية للمستخدم؛ تُسجَّل بعد إخفاء الأسرار
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[api] unhandled:", redactSecrets(msg));
  return json({ error: { code: "server_error", message: Errors.server().message } }, 500, extra);
}

/** قراءة جسم JSON مع حد أقصى للحجم */
export async function readJsonBody<T = unknown>(req: Request, maxBytes: number): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw Errors.payloadTooLarge();
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw Errors.payloadTooLarge();
  if (!text.trim()) throw Errors.badRequest("جسم الطلب فارغ.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw Errors.badRequest("جسم الطلب ليس JSON صالحًا.");
  }
}

export function requireMethod(req: Request, ...methods: string[]): void {
  if (!methods.includes(req.method)) throw Errors.methodNotAllowed();
}

/** غلاف موحد: معالجة OPTIONS، الأخطاء، وترويسات CORS */
export function withHandler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const res = await fn(req);
      if (Object.keys(cors).length === 0) return res;
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      return errorResponse(err, cors);
    }
  };
}

/** مهلة زمنية لأي وعد */
export async function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ApiError(504, "timeout", `انتهت مهلة ${label}. حاول مرة أخرى.`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
