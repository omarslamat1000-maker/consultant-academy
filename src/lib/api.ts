// ============================================================
// استدعاء Netlify Functions مع رمز الجلسة — رسائل خطأ عربية موحدة
// ============================================================
import { getAccessToken } from "./supabase.ts";

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 90000);
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") throw new ApiClientError(504, "timeout", "انتهت مهلة الطلب. حاول مرة أخرى.");
    throw new ApiClientError(0, "network", "تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت.");
  }
  clearTimeout(timer);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const code = data?.error?.code ?? "server_error";
    const message = data?.error?.message ?? "حدث خطأ غير متوقع.";
    throw new ApiClientError(res.status, code, message);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message || "حدث خطأ غير متوقع.";
  return "حدث خطأ غير متوقع.";
}
