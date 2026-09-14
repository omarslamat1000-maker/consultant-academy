// ============================================================
// مزود Google Gemini عبر REST — المفتاح يُرسل في ترويسة (لا في URL) ولا يُسجَّل أبدًا
// ============================================================
import { redactSecrets } from "../crypto.ts";
import { TEST_RESPONSE_SCHEMA } from "../../shared/gemini-schemas.ts";
import { ProviderError, type AIProvider, type GenerateJsonOptions, type GenerateJsonResult, type ProviderConfig, type ProviderTestResult } from "./types.ts";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const SUPPORTED_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-2.0-flash"] as const;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ProviderConfig, fetchImpl: typeof fetch = fetch) {
    this.model = config.model || DEFAULT_GEMINI_MODEL;
    this.apiKey = config.apiKey;
    this.temperature = config.temperature;
    this.maxOutputTokens = config.maxOutputTokens;
    this.fetchImpl = fetchImpl;
  }

  private supportsThinking(): boolean {
    return /gemini-(2\.5|3)/.test(this.model);
  }

  async generateJSON(opts: GenerateJsonOptions): Promise<GenerateJsonResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 55000);
    const generationConfig: Record<string, unknown> = {
      temperature: opts.temperature ?? this.temperature,
      maxOutputTokens: opts.maxOutputTokens ?? this.maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
    };
    if (this.supportsThinking()) generationConfig.thinkingConfig = { thinkingBudget: 1024 };

    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.user }] }],
          generationConfig,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new ProviderError(aborted ? 504 : 502, aborted ? "timeout" : "network", aborted ? "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي." : "تعذر الاتصال بمزود الذكاء الاصطناعي.");
    }
    clearTimeout(timeout);

    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) throw mapGeminiError(res.status, body);
    if (body.promptFeedback?.blockReason) throw new ProviderError(422, "blocked", "رفض المزود الطلب بسبب سياسات المحتوى.");
    const cand = body.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new ProviderError(502, "empty", "أعاد المزود استجابة فارغة.");
    return { text, latency_ms: Date.now() - started, finish_reason: cand?.finishReason };
  }

  async test(): Promise<ProviderTestResult> {
    const started = Date.now();
    try {
      const r = await this.generateJSON({
        system: "أنت خدمة فحص اتصال. أعد JSON فقط.",
        user: 'أعد {"ok": true, "echo": "consultant-academy"}',
        schema: TEST_RESPONSE_SCHEMA,
        temperature: 0,
        maxOutputTokens: 256,
        timeoutMs: 20000,
      });
      const parsed = JSON.parse(r.text) as { ok?: boolean };
      return { ok: parsed.ok === true, message: parsed.ok === true ? "الاتصال ناجح." : "استجابة غير متوقعة من المزود.", latency_ms: Date.now() - started, model: this.model };
    } catch (err) {
      const msg = err instanceof ProviderError ? err.message : "فشل اختبار الاتصال.";
      return { ok: false, message: msg, latency_ms: Date.now() - started, model: this.model };
    }
  }
}

function mapGeminiError(status: number, body: GeminiResponse): ProviderError {
  const raw = redactSecrets(body.error?.message ?? "");
  const lower = raw.toLowerCase();
  if (status === 400 && (lower.includes("api key") || lower.includes("api_key"))) return new ProviderError(401, "invalid_key", "مفتاح API غير صالح.");
  if (status === 401 || status === 403) return new ProviderError(401, "invalid_key", "مفتاح API مرفوض أو بلا صلاحية.");
  if (status === 404) return new ProviderError(404, "model_not_found", "النموذج المحدد غير متاح لهذا المفتاح.");
  if (status === 429) return new ProviderError(429, "quota", "تجاوز حصة الاستخدام لدى المزود. حاول لاحقًا.");
  if (status === 400) return new ProviderError(400, "bad_request", "رفض المزود الطلب (تحقق من النموذج والإعدادات).");
  return new ProviderError(502, "upstream", "خطأ من مزود الذكاء الاصطناعي.");
}
