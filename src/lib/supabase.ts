// ============================================================
// عميل Supabase للمتصفح — المفتاح القابل للنشر فقط، تحكمه سياسات RLS
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.ts";

export type BrowserClient = SupabaseClient<any, "academy", any>;

let client: BrowserClient | null = null;

export function getSupabase(): BrowserClient {
  if (IS_DEMO) throw new Error("Supabase غير مضبوط (الوضع التجريبي)");
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: { schema: "academy" },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }) as BrowserClient;
  }
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  if (IS_DEMO) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}
