// ============================================================
// مكتبة الحالات الداخلية — 50 حالة مكتوبة يدويًا مخزنة داخل المنصة
// تُستخدم: في الوضع التجريبي، وعند غياب مزود الذكاء الاصطناعي، وللبدء المباشر من صفحة المكتبة
// ============================================================
import type { CaseContent, Level, SectorKey, SkillKey } from "../types.ts";
import { BASE_CASES } from "./base.ts";
import { BEGINNER_CASES } from "./beginner.ts";
import { INTERMEDIATE_CASES } from "./intermediate.ts";
import { EXPERT_CASES } from "./expert.ts";
import { ADVANCED_CASES } from "./advanced.ts";

export const CASE_LIBRARY: readonly CaseContent[] = [
  ...BASE_CASES,
  ...BEGINNER_CASES,
  ...INTERMEDIATE_CASES,
  ...EXPERT_CASES,
  ...ADVANCED_CASES,
];

export const CASE_LIBRARY_SIZE = CASE_LIBRARY.length;

const byId = new Map(CASE_LIBRARY.map((c) => [c.library_id ?? "", c]));

export function getLibraryCase(libraryId: string): CaseContent | undefined {
  return byId.get(libraryId);
}

// ملخص خفيف للعرض في صفحة المكتبة (بلا الحل النموذجي أو البيانات المخفية)
export interface LibraryCaseSummary {
  library_id: string;
  title: string;
  sector: SectorKey;
  level: Level;
  skill: SkillKey;
  case_type: CaseContent["case_type"];
  problem_type: CaseContent["problem_type"];
  decision_type: CaseContent["decision_type"];
  client: string;
  core_problem: string;
  suggested_time_minutes: number;
  data_points: number;
}

export function summarizeLibrary(): LibraryCaseSummary[] {
  return CASE_LIBRARY.map((c) => ({
    library_id: c.library_id ?? "",
    title: c.title,
    sector: c.sector,
    level: c.level,
    skill: c.skill,
    case_type: c.case_type,
    problem_type: c.problem_type,
    decision_type: c.decision_type,
    client: c.client,
    core_problem: c.core_problem,
    suggested_time_minutes: c.suggested_time_minutes,
    data_points: c.available_data.length,
  }));
}
