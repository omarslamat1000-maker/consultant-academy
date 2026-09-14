// ============================================================
// خدمات لوحة المسؤول: المستخدمون، مراجعة الحالات، Prompts، الإحصاءات
// ============================================================
import { z } from "zod";
import { BUILTIN_PROMPTS, PROMPT_KEYS } from "../shared/prompts/index.ts";
import { AdminCaseReviewRequestSchema, AdminPromptRequestSchema, AdminUsersRequestSchema } from "../shared/schemas.ts";
import type { AuthedUser } from "./auth.ts";
import { audit } from "./audit.ts";
import { clearPromptCache } from "./prompts-loader.ts";
import { Errors } from "./respond.ts";
import type { AdminClient } from "./supabase-admin.ts";

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "الطلب"}: ${i.message}` : "الطلب غير صالح.";
}

export async function adminUsers(admin: AdminClient, actor: AuthedUser, body: unknown) {
  const parsed = AdminUsersRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const req = parsed.data;

  if (req.action === "list") {
    const perPage = 50;
    const { data, error } = await admin.auth.admin.listUsers({ page: req.page, perPage });
    if (error) throw Errors.server();
    const ids = data.users.map((u) => u.id);
    const [{ data: roles }, { data: profiles }, { data: attempts }] = await Promise.all([
      admin.from("roles").select("user_id, role").in("user_id", ids),
      admin.from("profiles").select("id, display_name, level, created_at").in("id", ids),
      admin.from("attempts").select("user_id, score").in("user_id", ids),
    ]);
    const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const stats = new Map<string, { n: number; sum: number }>();
    for (const a of (attempts ?? []) as any[]) {
      const s = stats.get(a.user_id) ?? { n: 0, sum: 0 };
      s.n++;
      s.sum += Number(a.score);
      stats.set(a.user_id, s);
    }
    return {
      page: req.page,
      per_page: perPage,
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        confirmed: Boolean(u.email_confirmed_at),
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        role: roleMap.get(u.id) ?? "learner",
        display_name: profMap.get(u.id)?.display_name ?? "",
        level: profMap.get(u.id)?.level ?? "beginner",
        attempts: stats.get(u.id)?.n ?? 0,
        avg_score: stats.get(u.id) ? Math.round((stats.get(u.id)!.sum / stats.get(u.id)!.n) * 10) / 10 : null,
      })),
    };
  }

  if (!req.user_id) throw Errors.badRequest("user_id مطلوب.");
  if (req.action === "set_role") {
    if (!req.role) throw Errors.badRequest("role مطلوب.");
    if (req.user_id === actor.id && req.role !== "admin") throw Errors.badRequest("لا يمكنك إزالة صلاحية المسؤول عن حسابك.");
    const { error } = await admin.from("roles").upsert({ user_id: req.user_id, role: req.role }, { onConflict: "user_id" });
    if (error) throw Errors.server();
    await audit(admin, actor.id, "user.set_role", "user", req.user_id, { role: req.role });
    return { ok: true };
  }
  if (req.action === "set_level") {
    if (!req.level) throw Errors.badRequest("level مطلوب.");
    const { error } = await admin.from("profiles").update({ level: req.level }).eq("id", req.user_id);
    if (error) throw Errors.server();
    await audit(admin, actor.id, "user.set_level", "user", req.user_id, { level: req.level });
    return { ok: true };
  }
  throw Errors.badRequest();
}

export async function adminCaseReview(admin: AdminClient, actor: AuthedUser, body: unknown) {
  const parsed = AdminCaseReviewRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const req = parsed.data;
  const { data, error } = await admin
    .from("generated_cases")
    .update({ review_status: req.review_status, is_reference_example: req.is_reference_example && req.review_status === "approved" })
    .eq("id", req.case_id)
    .select("id, review_status, is_reference_example")
    .maybeSingle();
  if (error) throw Errors.server();
  if (!data) throw Errors.notFound("الحالة");
  await audit(admin, actor.id, "case.review", "generated_case", req.case_id, { review_status: req.review_status, reference: data.is_reference_example });
  return data;
}

export async function adminPrompts(admin: AdminClient, actor: AuthedUser, body: unknown) {
  const parsed = AdminPromptRequestSchema.safeParse(body);
  if (!parsed.success) throw Errors.badRequest(firstIssue(parsed.error));
  const req = parsed.data;

  if (req.action === "list") {
    const { data, error } = await admin.from("prompt_templates").select("id, key, version, is_active, notes, created_at, updated_at, content").order("created_at", { ascending: false });
    if (error) throw Errors.server();
    return {
      builtin: PROMPT_KEYS.map((k) => ({ key: k, version: BUILTIN_PROMPTS[k].version, content: BUILTIN_PROMPTS[k].content })),
      custom: data ?? [],
    };
  }
  if (req.action === "create") {
    if (!req.key || !req.version || !req.content) throw Errors.badRequest("key وversion وcontent مطلوبة.");
    const { data, error } = await admin
      .from("prompt_templates")
      .insert({ key: req.key, version: req.version, content: req.content, notes: req.notes ?? "", is_active: false, created_by: actor.id })
      .select("id, key, version, is_active")
      .single();
    if (error) throw Errors.badRequest(error.code === "23505" ? "هذا الإصدار موجود مسبقًا لهذا القالب." : "تعذر حفظ القالب.");
    await audit(admin, actor.id, "prompt.create", "prompt_template", data.id, { key: req.key, version: req.version });
    return data;
  }
  if (!req.id) throw Errors.badRequest("id مطلوب.");
  if (req.action === "activate") {
    const { data: row } = await admin.from("prompt_templates").select("key").eq("id", req.id).maybeSingle();
    if (!row) throw Errors.notFound("القالب");
    await admin.from("prompt_templates").update({ is_active: false }).eq("key", row.key).eq("is_active", true);
    const { error } = await admin.from("prompt_templates").update({ is_active: true }).eq("id", req.id);
    if (error) throw Errors.server();
    clearPromptCache();
    await audit(admin, actor.id, "prompt.activate", "prompt_template", req.id, { key: row.key });
    return { ok: true };
  }
  if (req.action === "deactivate") {
    const { error } = await admin.from("prompt_templates").update({ is_active: false }).eq("id", req.id);
    if (error) throw Errors.server();
    clearPromptCache();
    await audit(admin, actor.id, "prompt.deactivate", "prompt_template", req.id, {});
    return { ok: true };
  }
  throw Errors.badRequest();
}

export async function adminStats(admin: AdminClient) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [users, attempts, cases, metrics, errors, audits, humanScored] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("attempts").select("score, evaluation_type, created_at").gte("created_at", since),
    admin.from("generated_cases").select("status, source, review_status, prompt_version").gte("created_at", since),
    admin.from("ai_metrics").select("kind, json_valid, repaired, regenerated, duplicate_rejected, similarity, latency_ms, prompt_version, error_code").gte("created_at", since),
    admin.from("ai_metrics").select("kind, error_code, created_at").not("error_code", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    admin.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, safe_metadata, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("attempts").select("score, human_score").not("human_score", "is", null).limit(500),
  ]);
  const att = (attempts.data ?? []) as any[];
  const cs = (cases.data ?? []) as any[];
  const mt = (metrics.data ?? []) as any[];
  const byVersion = new Map<string, { n: number; valid: number; dup: number; latency: number }>();
  for (const m of mt) {
    const v = byVersion.get(m.prompt_version) ?? { n: 0, valid: 0, dup: 0, latency: 0 };
    v.n++;
    if (m.json_valid) v.valid++;
    if (m.duplicate_rejected) v.dup++;
    v.latency += Number(m.latency_ms);
    byVersion.set(m.prompt_version, v);
  }
  const hs = (humanScored.data ?? []) as any[];
  const drift = hs.length ? Math.round((hs.reduce((s, a) => s + Math.abs(Number(a.score) - Number(a.human_score)), 0) / hs.length) * 10) / 10 : null;
  return {
    users_total: users.count ?? 0,
    attempts_30d: att.length,
    avg_score_30d: att.length ? Math.round((att.reduce((s, a) => s + Number(a.score), 0) / att.length) * 10) / 10 : 0,
    ai_evaluations_30d: att.filter((a) => a.evaluation_type === "ai").length,
    cases_30d: cs.length,
    cases_active: cs.filter((c) => c.status === "active").length,
    cases_rejected_duplicate: cs.filter((c) => c.status === "rejected_duplicate").length,
    cases_pending_review: cs.filter((c) => c.review_status === "pending" && c.source === "ai").length,
    ai_calls_30d: mt.length,
    json_valid_rate: mt.length ? Math.round((mt.filter((m) => m.json_valid).length / mt.length) * 1000) / 10 : null,
    repair_rate: mt.length ? Math.round((mt.filter((m) => m.repaired).length / mt.length) * 1000) / 10 : null,
    duplicate_rate: mt.filter((m) => m.kind === "generate").length
      ? Math.round((mt.filter((m) => m.kind === "generate" && m.duplicate_rejected).length / mt.filter((m) => m.kind === "generate").length) * 1000) / 10
      : null,
    avg_latency_ms: mt.length ? Math.round(mt.reduce((s, m) => s + Number(m.latency_ms), 0) / mt.length) : null,
    human_ai_drift: drift,
    human_scored_count: hs.length,
    prompt_versions: [...byVersion.entries()].map(([version, v]) => ({ version, calls: v.n, json_valid_rate: Math.round((v.valid / v.n) * 1000) / 10, duplicate_rejected: v.dup, avg_latency_ms: Math.round(v.latency / v.n) })),
    recent_errors: errors.data ?? [],
    audit_logs: audits.data ?? [],
  };
}
