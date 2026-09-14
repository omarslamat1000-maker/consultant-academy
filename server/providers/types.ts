// ============================================================
// محوّل المزود (Provider Adapter) — يسمح بإضافة مزودين آخرين دون إعادة كتابة النظام
// ============================================================

export type GeminiSchema = {
  type: string;
  description?: string;
  enum?: readonly string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  nullable?: boolean;
  propertyOrdering?: string[];
};

export interface GenerateJsonOptions {
  system: string;
  user: string;
  schema: GeminiSchema;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface GenerateJsonResult {
  text: string;
  latency_ms: number;
  finish_reason?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  latency_ms: number;
  model: string;
}

export interface AIProvider {
  readonly name: "gemini";
  readonly model: string;
  generateJSON(opts: GenerateJsonOptions): Promise<GenerateJsonResult>;
  test(): Promise<ProviderTestResult>;
}

export interface ProviderConfig {
  provider: "gemini";
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
}

export class ProviderError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
  }
}
