// ============================================================
// Netlify Function (v2) — /api/ai-provider/delete
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { json, readJsonBody, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireAdmin } from "../../server/auth.ts";
import { deleteProvider } from "../../server/ai-provider-admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "POST");
  const admin = getAdminClient();
  const user = await requireAdmin(req, admin);
  await enforceRateLimit(admin, "provider_write", user.id);
  const body = await readJsonBody(req, 4 * 1024);
  const out = await deleteProvider(admin, user, body);
  return json(out);
});

export const config: Config = { path: "/api/ai-provider/delete" };
