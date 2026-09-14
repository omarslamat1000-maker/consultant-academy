// ============================================================
// Netlify Function (v2) — /api/admin/stats
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { json, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireAdmin } from "../../server/auth.ts";
import { adminStats } from "../../server/admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "GET", "POST");
  const admin = getAdminClient();
  const user = await requireAdmin(req, admin);
  await enforceRateLimit(admin, "admin", user.id);
  const out = await adminStats(admin);
  return json(out);
});

export const config: Config = { path: "/api/admin/stats" };
