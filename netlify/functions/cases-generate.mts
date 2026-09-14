// ============================================================
// Netlify Function (v2) — /api/cases/generate
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { Errors, json, readJsonBody, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireUser } from "../../server/auth.ts";
import { GenerateCaseRequestSchema } from "../../shared/schemas.ts";
import { generateCase } from "../../server/cases.ts";
import { firstIssue } from "../../server/ai-provider-admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "POST");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  await enforceRateLimit(admin, "generate", user.id);
  await enforceRateLimit(admin, "global_ai", "all");
  const body = await readJsonBody(req, 8 * 1024);
  const parsed = GenerateCaseRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const out = await generateCase(admin, user, parsed.data, user.preferred_sector);
  return json(out);
});

export const config: Config = { path: "/api/cases/generate" };
