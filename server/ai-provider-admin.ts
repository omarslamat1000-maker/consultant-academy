// ============================================================
// إدارة مزودي الذكاء الاصطناعي من لوحة المسؤول — لا تُعاد القيمة السرية أبدًا
// ============================================================
import { z } from "zod";
import { ProviderIdRequestSchema, ProviderRotateRequestSchema, ProviderSaveRequestSchema, ProviderTestRequestSchema } from "../shared/schemas.ts";
import type { AuthedUser } from "./auth.ts";
import { audit } from "./audit.ts";
import { decryptSecret, encryptSecret, isEncryptionConfigured, keyHint } from "./crypto.ts";
import { createProvider } from "./providers/index.ts";
import { DEFAULT_GEMINI_MODEL } from "./providers/gemini.ts";
import { Errors } from "./respond.ts";
import type { AdminClient } from "./supabase-admin.ts";

export interface ProviderPublicRow {
  id: string;
  provider: string;
  model: string;
  temperature: number;
  max_output_tokens: number;
  key_hint: string;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  created_at: string;
  updated_at: string;
  created_by_name: string;
  updated_by_name: string;
}

const PUBLIC_COLUMNS = "id, provider, model, temperature, max_output_tokens, key_hint, is_active, last_tested_at, last_test_ok, created_at, updated_at, created_by, updated_by";

async function toPublic(admin: AdminClient, row: any): Promise<ProviderPublicRow> {
  const ids = [row.created_by, row.updated_by].filter(Boolean);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await admin.from("profiles").select("id, display_name").in("id", ids);
    for (const p of (data ?? []) as any[]) names.set(p.id, p.display_name);
  }
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    temperature: Number(row.temperature),
    max_output_tokens: row.max_output_tokens,
    key_hint: row.key_hint,
    is_active: row.is_active,
    last_tested_at: row.last_tested_at,
    last_test_ok: row.last_test_ok,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by_name: names.get(row.created_by) ?? "",
    updated_by_name: names.get(row.updated_by) ?? "",
  };
}

export async function listProviders(admin: AdminClient): Promise<{ providers: ProviderPublicRow[]; encryption_ready: boolean; env_fallback: boolean }> {
  const { data, error } = await admin.from("ai_providers").select(PUBLIC_COLUMNS).order("created_at", { ascending: false });
  if (error) throw Errors.server();
  const providers = await Promise.all((data ?? []).map((r: any) => toPublic(admin, r)));
  return { providers, encryption_ready: isEncryptionConfigured(), env_fallback: Boolean(process.env.GEMINI_API_KEY?.trim()) };
}

export async function saveProvider(admin: AdminClient, actor: AuthedUser, body: unknown): Promise<ProviderPublicRow> {
  if (!isEncryptionConfigured()) throw Errors.encryptionNotConfigured();
  const parsed = ProviderSaveRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const req = parsed.data;
  const enc = encryptSecret(req.api_key);

  // مزود نشط واحد في كل مرة: تعطيل السابقين
  await admin.from("ai_providers").update({ is_active: false, updated_by: actor.id }).eq("is_active", true);
  const { data, error } = await admin
    .from("ai_providers")
    .insert({
      provider: req.provider,
      model: req.model || DEFAULT_GEMINI_MODEL,
      temperature: req.temperature,
      max_output_tokens: req.max_output_tokens,
      encrypted_secret: enc.encrypted_secret,
      secret_iv: enc.secret_iv,
      auth_tag: enc.auth_tag,
      key_hint: keyHint(req.api_key),
      is_active: true,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error || !data) {
    console.error("[ai-provider] insert failed:", error?.message);
    throw Errors.server();
  }
  await audit(admin, actor.id, "ai_provider.save", "ai_provider", data.id, { provider: req.provider, model: req.model, key_hint: keyHint(req.api_key) });
  return toPublic(admin, data);
}

export async function testProvider(admin: AdminClient, actor: AuthedUser, body: unknown) {
  const parsed = ProviderTestRequestSchema.safeParse(body ?? {});
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const req = parsed.data;
  let apiKey = req.api_key;
  let model = req.model ?? DEFAULT_GEMINI_MODEL;
  let providerId: string | null = null;
  let temperature = 0.7;
  let maxOutputTokens = 8192;

  if (!apiKey) {
    if (!isEncryptionConfigured()) throw Errors.encryptionNotConfigured();
    const { data } = await admin.from("ai_providers").select("*").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) throw Errors.notFound("مزود نشط");
    providerId = data.id;
    model = req.model ?? data.model;
    temperature = Number(data.temperature);
    maxOutputTokens = data.max_output_tokens;
    try {
      apiKey = decryptSecret({ encrypted_secret: data.encrypted_secret, secret_iv: data.secret_iv, auth_tag: data.auth_tag });
    } catch {
      throw Errors.aiFailed("تعذر فك تشفير المفتاح المحفوظ (ربما تغيّر CONFIG_ENCRYPTION_KEY). أعد إدخال المفتاح.");
    }
  }
  const provider = createProvider({ provider: "gemini", model, apiKey, temperature, maxOutputTokens });
  const result = await provider.test();
  if (providerId) {
    await admin.from("ai_providers").update({ last_tested_at: new Date().toISOString(), last_test_ok: result.ok, updated_by: actor.id }).eq("id", providerId);
  }
  await audit(admin, actor.id, "ai_provider.test", "ai_provider", providerId, { ok: result.ok, model, latency_ms: result.latency_ms, message: result.message });
  return { ok: result.ok, message: result.message, latency_ms: result.latency_ms, model };
}

export async function rotateProvider(admin: AdminClient, actor: AuthedUser, body: unknown): Promise<ProviderPublicRow> {
  if (!isEncryptionConfigured()) throw Errors.encryptionNotConfigured();
  const parsed = ProviderRotateRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const enc = encryptSecret(parsed.data.api_key);
  const { data, error } = await admin
    .from("ai_providers")
    .update({ encrypted_secret: enc.encrypted_secret, secret_iv: enc.secret_iv, auth_tag: enc.auth_tag, key_hint: keyHint(parsed.data.api_key), last_tested_at: null, last_test_ok: null, updated_by: actor.id })
    .eq("id", parsed.data.id)
    .select(PUBLIC_COLUMNS)
    .maybeSingle();
  if (error) throw Errors.server();
  if (!data) throw Errors.notFound("المزود");
  await audit(admin, actor.id, "ai_provider.rotate", "ai_provider", data.id, { key_hint: keyHint(parsed.data.api_key) });
  return toPublic(admin, data);
}

export async function setProviderActive(admin: AdminClient, actor: AuthedUser, body: unknown, active: boolean): Promise<ProviderPublicRow> {
  const parsed = ProviderIdRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  if (active) await admin.from("ai_providers").update({ is_active: false, updated_by: actor.id }).eq("is_active", true);
  const { data, error } = await admin.from("ai_providers").update({ is_active: active, updated_by: actor.id }).eq("id", parsed.data.id).select(PUBLIC_COLUMNS).maybeSingle();
  if (error) throw Errors.server();
  if (!data) throw Errors.notFound("المزود");
  await audit(admin, actor.id, active ? "ai_provider.enable" : "ai_provider.disable", "ai_provider", data.id, {});
  return toPublic(admin, data);
}

export async function deleteProvider(admin: AdminClient, actor: AuthedUser, body: unknown): Promise<{ deleted: true }> {
  const parsed = ProviderIdRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const { error, count } = await admin.from("ai_providers").delete({ count: "exact" }).eq("id", parsed.data.id);
  if (error) throw Errors.server();
  if (!count) throw Errors.notFound("المزود");
  await audit(admin, actor.id, "ai_provider.delete", "ai_provider", parsed.data.id, {});
  return { deleted: true };
}

export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "الطلب"}: ${i.message}` : "الطلب غير صالح.";
}
