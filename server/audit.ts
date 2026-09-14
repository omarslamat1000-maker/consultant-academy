// ============================================================
// سجل العمليات — بلا أي قيمة سرية
// ============================================================
import type { AdminClient } from "./supabase-admin.ts";
import { redactSecrets } from "./crypto.ts";

const FORBIDDEN_KEYS = /(api[_-]?key|secret|token|password|authorization|encrypted)/i;

/** ينقّي البيانات الوصفية من أي حقل يشبه سرًا قبل التخزين */
export function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    if (typeof v === "string") out[k] = redactSecrets(v).slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((x) => (typeof x === "string" ? redactSecrets(x).slice(0, 200) : x));
    else if (typeof v === "object") out[k] = sanitizeMetadata(v as Record<string, unknown>);
  }
  return out;
}

export async function audit(
  admin: AdminClient,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    safe_metadata: sanitizeMetadata(meta),
  });
  if (error) console.error("[audit] insert failed:", error.message);
}

export async function recordMetric(
  admin: AdminClient,
  m: {
    kind: "generate" | "evaluate" | "follow_up" | "recommend" | "test";
    prompt_version?: string;
    model?: string;
    json_valid?: boolean;
    repaired?: boolean;
    regenerated?: boolean;
    duplicate_rejected?: boolean;
    similarity?: number | null;
    latency_ms?: number;
    error_code?: string | null;
    user_id?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from("ai_metrics").insert({
    kind: m.kind,
    prompt_version: m.prompt_version ?? "",
    model: m.model ?? "",
    json_valid: m.json_valid ?? true,
    repaired: m.repaired ?? false,
    regenerated: m.regenerated ?? false,
    duplicate_rejected: m.duplicate_rejected ?? false,
    similarity: m.similarity ?? null,
    latency_ms: m.latency_ms ?? 0,
    error_code: m.error_code ?? null,
    user_id: m.user_id ?? null,
  });
  if (error) console.error("[metrics] insert failed:", error.message);
}
