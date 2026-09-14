// ============================================================
// عميل Supabase الخادمي (service_role) — لا يُستخدم في المتصفح إطلاقًا
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Errors } from "./respond.ts";

export type AdminClient = SupabaseClient<any, "academy", any>;

let cached: AdminClient | null = null;

export function getAdminClient(): AdminClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw Errors.server();
  }
  cached = createClient(url, key, {
    db: { schema: "academy" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "consultant-academy-functions" } },
  }) as AdminClient;
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** للاختبارات: حقن عميل بديل */
export function __setAdminClientForTests(client: AdminClient | null): void {
  cached = client;
}
