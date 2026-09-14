// ============================================================
// Netlify Function (v2) — /api/admin/cases/review
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { json, readJsonBody, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireAdmin } from "../../server/auth.ts";
import { adminCaseReview } from "../../server/admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "POST");
  const admin = getAdminClient();
  const user = await requireAdmin(req, admin);
  await enforceRateLimit(admin, "admin", user.id);
  const body = await readJsonBody(req, 8 * 1024);
  const out = await adminCaseReview(admin, user, body);
  return json(out);
});

export const config: Config = { path: "/api/admin/cases/review" };
