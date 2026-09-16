// ============================================================
// Netlify Function (v2) — /api/peers/compare
// موقع المتدرب ضمن توزيع درجات الأقران (نسب مجهولة الهوية فقط)
// ============================================================
import type { Config } from "@netlify/functions";
import { json, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireUser } from "../../server/auth.ts";
import { buildPeerComparison } from "../../server/peers.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "GET", "POST");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  await enforceRateLimit(admin, "peers", user.id);
  return json(await buildPeerComparison(admin, user));
});

export const config: Config = { path: "/api/peers/compare" };
