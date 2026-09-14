// ============================================================
// تحويل سجل الحالة إلى نسخة عرض آمنة للمتدرب (بلا حل ولا إجابة معيارية ولا قيم البيانات المخفية)
// ============================================================
import type { CasePublicView, CaseRecord } from "./types.ts";

export function toPublicView(row: CaseRecord): CasePublicView {
  const c = row.content;
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    title: c.title,
    sector: c.sector,
    level: c.level,
    skill: c.skill,
    case_type: row.case_type,
    problem_type: c.problem_type,
    decision_type: c.decision_type,
    context: c.context,
    client: c.client,
    core_problem: c.core_problem,
    decision_required: c.decision_required,
    objectives: c.objectives,
    constraints: c.constraints,
    available_data: c.available_data,
    hidden_data_labels: (c.hidden_data ?? []).map((h) => ({ key: h.key, label: h.label })),
    suggested_time_minutes: c.suggested_time_minutes,
    interviewer_questions: row.case_type === "interviewer_led" ? (c.interviewer_questions ?? []) : [],
    source: row.source,
    prompt_version: row.prompt_version,
    created_at: row.created_at,
    similarity_score: Number(row.similarity_score ?? 0),
  };
}
