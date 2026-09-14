// ============================================================
// تحميل القالب النشط: من جدول prompt_templates إن وُجد إصدار نشط، وإلا الإصدار المضمَّن
// ============================================================
import { BUILTIN_PROMPTS, type PromptKey } from "../shared/prompts/index.ts";
import type { AdminClient } from "./supabase-admin.ts";

export interface LoadedPrompt {
  key: PromptKey;
  version: string;
  content: string;
  source: "db" | "builtin";
}

const cache = new Map<PromptKey, { loaded: LoadedPrompt; at: number }>();
const CACHE_MS = 60_000;

export async function loadPrompt(admin: AdminClient | null, key: PromptKey): Promise<LoadedPrompt> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < CACHE_MS) return c.loaded;
  let loaded: LoadedPrompt = { key, version: BUILTIN_PROMPTS[key].version, content: BUILTIN_PROMPTS[key].content, source: "builtin" };
  if (admin) {
    const { data } = await admin.from("prompt_templates").select("version, content").eq("key", key).eq("is_active", true).maybeSingle();
    if (data?.content) loaded = { key, version: data.version, content: data.content, source: "db" };
  }
  cache.set(key, { loaded, at: Date.now() });
  return loaded;
}

export function clearPromptCache(): void {
  cache.clear();
}
