// ============================================================
// Netlify Function (v2) — /api/review/grade
// تصحيح مراجعة بطاقة خادميًا وإعادة جدولتها (SM-2 مبسّط)
// ============================================================
import type { Config } from "@netlify/functions";
import { Errors, json, readJsonBody, requireMethod, withHandler } from "../../server/respond.ts";
import { getAdminClient } from "../../server/supabase-admin.ts";
import { enforceRateLimit } from "../../server/rate-limit.ts";
import { requireUser } from "../../server/auth.ts";
import { ReviewGradeRequestSchema } from "../../shared/schemas.ts";
import { gradeReview } from "../../server/review.ts";
import { firstIssue } from "../../server/ai-provider-admin.ts";

export default withHandler(async (req: Request) => {
  requireMethod(req, "POST");
  const admin = getAdminClient();
  const user = await requireUser(req, admin);
  await enforceRateLimit(admin, "review", user.id);
  const body = await readJsonBody(req, 32 * 1024);
  const parsed = ReviewGradeRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  return json(await gradeReview(admin, user, parsed.data));
});

export const config: Config = { path: "/api/review/grade" };
