// ============================================================
// Netlify Function (v2) — /api/cases/evaluate
// تحقق من JWT، الدور عند الحاجة، حجم الطلب، حدود المعدل، والتحقق من المدخلات
// ============================================================
import type { Config } from "@netlify/functions";
import { Errors, json, readJsonBody, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireUser } from "../../server/auth.ts";
import { EvaluateRequestSchema } from "../../shared/schemas.ts";
import { evaluateAnswer } from "../../server/cases.ts";
import { firstIssue } from "../../server/ai-provider-admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "POST");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  await enforceRateLimit(admin, "evaluate", user.id);
  await enforceRateLimit(admin, "global_ai", "all");
  const body = await readJsonBody(req, 128 * 1024);
  const parsed = EvaluateRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const out = await evaluateAnswer(admin, user, parsed.data);
  return json(out);
});

export const config: Config = { path: "/api/cases/evaluate" };
