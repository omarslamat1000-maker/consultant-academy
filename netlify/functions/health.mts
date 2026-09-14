// ============================================================
// Netlify Function (v2) — /api/health
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { json, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { isSupabaseConfigured } from "../../server/supabase-admin.ts";
import { aiStatus } from "../../server/providers/index.ts";
import { isEncryptionConfigured } from "../../server/crypto.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "GET");
  const supabase = isSupabaseConfigured();
  let ai = false;
  if (supabase) {
    try {
      ai = (await aiStatus(getAdminClient())).configured;
    } catch {
      ai = false;
    }
  }
  return json({ ok: true, supabase, ai, encryption_ready: isEncryptionConfigured(), version: "1.0.0" });
});

export const config: Config = { path: "/api/health" };
