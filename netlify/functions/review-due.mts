// ============================================================
// Netlify Function (v2) — /api/review/due
// بطاقات المراجعة المتباعدة المستحقة للمستخدم الحالي (بلا إجابات صحيحة)
// ============================================================
import type { Config } from "@netlify/functions";
import { json, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireUser } from "../../server/auth.ts";
import { listDueCards } from "../../server/review.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "GET", "POST");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  await enforceRateLimit(admin, "review", user.id);
  return json(await listDueCards(admin, user));
});

export const config: Config = { path: "/api/review/due" };
