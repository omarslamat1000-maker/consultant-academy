// ============================================================
// Netlify Function (v2) — /api/ai-provider/status
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { json, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { requireUser } from "../../server/auth.ts";
import { aiStatus } from "../../server/providers/index.ts";
import { listProviders } from "../../server/ai-provider-admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "GET");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  const status = await aiStatus(admin);
  if (user.role !== "admin") return json({ configured: status.configured });
  const list = await listProviders(admin);
  return json({ ...status, ...list });
});

export const config: Config = { path: "/api/ai-provider/status" };
