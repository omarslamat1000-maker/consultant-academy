// ============================================================
// المسارات المهنية حسب الدور: تُعيد ترتيب الوحدات داخل المستوى وتُثقّل القطاعات عند اختيار الحالة
// (لا تغيّر قواعد الانتقال بين المستويات ولا أوزان التقييم)
// ============================================================
import { TRACK_LABELS, TRACKS, type SectorKey, type SkillKey, type TrackKey } from "./types.ts";
import type { ModuleLite } from "./recommendation-engine.ts";

export interface TrackProfile {
  key: TrackKey;
  label: string;
  description: string;
  /** المهارات ذات الأولوية: وحداتها تتقدم داخل المستوى وتُفضَّل في التوصية */
  priority_skills: SkillKey[];
  /** القطاعات المفضلة: تُختار منها الحالات بالتناوب ما لم يحدد المتدرب قطاعًا */
  sectors: SectorKey[];
}

export const TRACK_PROFILES: Record<TrackKey, TrackProfile> = {
  pmo_manager: {
    key: "pmo_manager",
    label: TRACK_LABELS.pmo_manager,
    description: "قيادة محافظ وبرامج المشاريع: البوابات، إعادة الترتيب، التعافي من التعثر، والحوكمة التعاقدية.",
    priority_skills: ["portfolio_evaluation", "execution_planning", "risk_governance", "prioritization"],
    sectors: ["pmo_p3o", "portfolio_program_management", "capital_projects", "roads_bridges", "municipal_infrastructure"],
  },
  performance_analyst: {
    key: "performance_analyst",
    label: TRACK_LABELS.performance_analyst,
    description: "تحويل البيانات إلى قرار: المؤشرات، جودة البيانات، الأسباب الجذرية، والفرضيات القابلة للاختبار.",
    priority_skills: ["data_identification", "quantitative", "root_cause", "hypotheses"],
    sectors: ["performance_kpis", "ai_data_analytics", "government", "grc", "stormwater"],
  },
  transformation_consultant: {
    key: "transformation_consultant",
    label: TRACK_LABELS.transformation_consultant,
    description: "تشخيص المشكلة المؤسسية وإعادة صياغتها والدفاع عن التوصية أمام القيادة.",
    priority_skills: ["problem_definition", "structuring", "communication", "case_interview"],
    sectors: ["institutional_transformation", "strategic_planning", "investment_partnerships", "urban_development", "parks_humanization"],
  },
};

export function isTrackKey(v: unknown): v is TrackKey {
  return typeof v === "string" && (TRACKS as readonly string[]).includes(v);
}

/** ترتيب مستقر: داخل كل مستوى تتقدم الوحدات التي مهارتها الرئيسة ضمن أولويات المسار، ثم ترتيب الوحدة الأصلي */
export function orderModulesForTrack<T extends ModuleLite>(modules: T[], track: TrackKey | null | undefined): T[] {
  if (!track) return modules.slice().sort((a, b) => a.order_index - b.order_index);
  const pri = TRACK_PROFILES[track].priority_skills;
  const rank = (m: ModuleLite) => {
    const i = m.primary_skill ? pri.indexOf(m.primary_skill) : -1;
    return i === -1 ? pri.length : i;
  };
  return modules.slice().sort((a, b) => rank(a) - rank(b) || a.order_index - b.order_index);
}

export function isPriorityModule(m: ModuleLite, track: TrackKey | null | undefined): boolean {
  return Boolean(track && m.primary_skill && TRACK_PROFILES[track].priority_skills.includes(m.primary_skill));
}

/** أقل قطاعات المسار استخدامًا مؤخرًا (تناوب داخل قطاعات المسار) */
export function pickTrackSector(track: TrackKey, recentSectors: string[]): SectorKey {
  const counts = new Map<string, number>();
  for (const s of recentSectors) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best: SectorKey = TRACK_PROFILES[track].sectors[0];
  let bestCount = Infinity;
  for (const s of TRACK_PROFILES[track].sectors) {
    const n = counts.get(s) ?? 0;
    if (n < bestCount) {
      best = s;
      bestCount = n;
    }
  }
  return best;
}
