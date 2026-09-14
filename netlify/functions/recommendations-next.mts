// ============================================================
// Netlify Function (v2) — /api/recommendations/next
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { json, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireUser } from "../../server/auth.ts";
import { buildRecommendation } from "../../server/recommendations.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "POST", "GET");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  await enforceRateLimit(admin, "recommend", user.id);
  const out = await buildRecommendation(admin, user);
  return json(out);
});

export const config: Config = { path: "/api/recommendations/next" };
