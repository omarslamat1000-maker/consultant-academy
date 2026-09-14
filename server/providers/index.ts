// ============================================================
// سجل المزودين + حل الإعدادات النشطة (قاعدة البيانات المشفّرة أو متغيرات البيئة)
// ============================================================
import { decryptSecret, isEncryptionConfigured } from "../crypto.ts";
import type { AdminClient } from "../supabase-admin.ts";
import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./gemini.ts";
import type { AIProvider, ProviderConfig } from "./types.ts";

export function createProvider(config: ProviderConfig, fetchImpl?: typeof fetch): AIProvider {
  switch (config.provider) {
    case "gemini":
      return new GeminiProvider(config, fetchImpl);
    default:
      throw new Error(`Unsupported provider: ${String(config.provider)}`);
  }
}

export interface ResolvedAIConfig extends ProviderConfig {
  source: "db" | "env";
  providerId: string | null;
}

/**
 * يحل إعدادات المزود النشط: أولًا الصف النشط في ai_providers (يُفك تشفيره خادميًا)،
 * ثم GEMINI_API_KEY من البيئة كبديل. يعيد null إن لم يُضبط شيء.
 */
export async function resolveAIConfig(admin: AdminClient | null): Promise<ResolvedAIConfig | null> {
  if (admin && isEncryptionConfigured()) {
    const { data, error } = await admin
      .from("ai_providers")
      .select("id, provider, model, temperature, max_output_tokens, encrypted_secret, secret_iv, auth_tag")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      try {
        const apiKey = decryptSecret({ encrypted_secret: data.encrypted_secret, secret_iv: data.secret_iv, auth_tag: data.auth_tag });
        return {
          source: "db",
          providerId: data.id,
          provider: data.provider,
          model: data.model || DEFAULT_GEMINI_MODEL,
          apiKey,
          temperature: Number(data.temperature ?? 0.7),
          maxOutputTokens: Number(data.max_output_tokens ?? 8192),
        };
      } catch (err) {
        console.error("[ai-config] failed to decrypt active provider secret (was CONFIG_ENCRYPTION_KEY rotated?)", err instanceof Error ? err.message : "");
      }
    }
  }
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) {
    return {
      source: "env",
      providerId: null,
      provider: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      apiKey: envKey,
      temperature: 0.7,
      maxOutputTokens: 8192,
    };
  }
  return null;
}

/** حالة عامة آمنة (بلا أسرار) لعرضها للمستخدم */
export async function aiStatus(admin: AdminClient | null): Promise<{ configured: boolean; source: "db" | "env" | null; model: string | null; encryption_ready: boolean }> {
  const cfg = await resolveAIConfig(admin);
  return { configured: cfg !== null, source: cfg?.source ?? null, model: cfg?.model ?? null, encryption_ready: isEncryptionConfigured() };
}
