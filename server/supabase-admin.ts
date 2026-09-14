// ============================================================
// عميل Supabase الخادمي (service_role) — لا يُستخدم في المتصفح إطلاقًا
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Errors } from "./respond.ts";
import { createServiceClient } from "./rpc-admin.ts";

export type AdminClient = SupabaseClient<any, "academy", any>;

let cached: AdminClient | null = null;

export function getAdminClient(): AdminClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // بديل اختياري: قناة خدمية (الترحيل 0007) بالمفتاح القابل للنشر + سر خادمي، عند غياب service_role
  const svcSecret = process.env.FUNCTIONS_SERVICE_SECRET?.trim();
  const anon = (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim();
  if (url && !key && svcSecret && anon) {
    cached = createServiceClient({ url, anonKey: anon, secret: svcSecret }) as unknown as AdminClient;
    return cached;
  }
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
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return true;
  return Boolean(process.env.FUNCTIONS_SERVICE_SECRET?.trim() && (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim());
}

/** للاختبارات: حقن عميل بديل */
export function __setAdminClientForTests(client: AdminClient | null): void {
  cached = client;
}
