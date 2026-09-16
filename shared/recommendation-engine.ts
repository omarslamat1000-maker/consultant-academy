// ============================================================
// محرك التوصية الحتمي — مشترك بين الخادم والوضع التجريبي
// ============================================================
import { suggestedCaseLevel } from "./level-rules.ts";
import { SECTORS, SKILL_LABELS, SKILLS, type Level, type LevelProgressReport, type NextRecommendation, type SectorKey, type SkillKey, type TrackKey, type WeeklyPlanItem } from "./types.ts";
import { orderModulesForTrack, pickTrackSector } from "./tracks.ts";

export interface ModuleLite {
  id: string;
  title: string;
  level: Level;
  order_index: number;
  primary_skill?: SkillKey;
}

export interface DecideNextInput {
  level: Level;
  report: LevelProgressReport;
  modules: ModuleLite[];
  completedModuleIds: Set<string>;
  masteryMap: Partial<Record<SkillKey, number>>;
  staleSkills: SkillKey[];
  weakSkills: SkillKey[];
  preferredSector: SectorKey | null;
  caseSectors: string[];
  /** المسار المهني: يعيد ترتيب وحدات المستوى ويوجّه اختيار القطاع */
  track?: TrackKey | null;
}

export function decideNext(p: DecideNextInput): NextRecommendation {
  const levelModules = orderModulesForTrack(p.modules.filter((m) => m.level === p.level), p.track);
  const firstIncomplete = levelModules.find((m) => !p.completedModuleIds.has(m.id));

  if (firstIncomplete) {
    return {
      kind: "module",
      title: `ادرس وحدة: ${firstIncomplete.title}`,
      reason: p.track && firstIncomplete.primary_skill && orderModulesForTrack([firstIncomplete], p.track).length ? "لم تكتمل بعد، وهي شرط للانتقال إلى المستوى التالي (رُتبت وفق مسارك المهني)." : "لم تكتمل بعد، وهي شرط للانتقال إلى المستوى التالي.",
      skill: firstIncomplete.primary_skill ?? "problem_definition",
      level: p.level,
      module_id: firstIncomplete.id,
    };
  }
  if (p.report.regression_detected) {
    const skill = p.weakSkills[0] ?? "structuring";
    const mod = p.modules.find((m) => m.primary_skill === skill);
    return {
      kind: "review",
      title: `مراجعة موجهة: ${SKILL_LABELS[skill].ar}`,
      reason: "لوحظ تراجع في آخر ثلاث محاولات؛ نقترح مراجعة سريعة ثم حالة أسهل قليلًا لاستعادة الثبات (بلا خفض للمستوى).",
      skill,
      level: p.level,
      module_id: mod?.id,
    };
  }
  const sector = p.preferredSector ?? (p.track ? pickTrackSector(p.track, p.caseSectors) : leastUsedSector(p.caseSectors));
  const caseLevel = suggestedCaseLevel(p.level, p.report);
  const target = p.weakSkills[0] ?? p.staleSkills[0] ?? "communication";
  return {
    kind: "case",
    title: `حالة جديدة: ${SKILL_LABELS[target].ar}`,
    reason: p.weakSkills[0]
      ? `درجة إتقانك في هذه المهارة ${Math.round(p.masteryMap[target] ?? 0)} وهي الأدنى لديك.`
      : p.staleSkills[0]
        ? "لم تمارس هذه المهارة خلال الأسبوعين الماضيين."
        : "تثبيت مهارة التواصل التنفيذي بتحدي زمني.",
    skill: target,
    level: caseLevel,
    sector,
    case_type: caseLevel === "advanced_expert" || caseLevel === "expert" ? "interviewer_led" : "candidate_led",
    timed: target === "communication",
  };
}

export function leastUsedSector(sectors: string[]): SectorKey {
  const counts = new Map<string, number>();
  for (const s of sectors) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best: SectorKey = SECTORS[0];
  let bestCount = Infinity;
  for (const s of SECTORS) {
    const n = counts.get(s) ?? 0;
    if (n < bestCount) {
      best = s;
      bestCount = n;
    }
  }
  return best;
}

export function deterministicPlan(weak: SkillKey[], stale: SkillKey[], strong: SkillKey[], report: LevelProgressReport): { weekly: WeeklyPlanItem[]; development: string[]; focus: string } {
  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const focusSkills: SkillKey[] = [...weak, ...stale.filter((s) => !weak.includes(s)), ...strong.filter((s) => !weak.includes(s) && !stale.includes(s))].slice(0, 6);
  let i = 0;
  while (focusSkills.length < 6) {
    const s = SKILLS[i++ % SKILLS.length];
    if (!focusSkills.includes(s)) focusSkills.push(s);
  }
  const weekly: WeeklyPlanItem[] = days.map((day, idx) => {
    const f = focusSkills[idx];
    const activity =
      idx < 3
        ? `حالة تطبيقية في ${SKILL_LABELS[f].ar} (20 دقيقة) ثم مراجعة التقييم`
        : idx < 5
          ? `تمرين موجه في ${SKILL_LABELS[f].ar} + 10 دقائق حساب ذهني`
          : `تحدي 90 ثانية: تقديم توصية شفهية في ${SKILL_LABELS[f].ar}`;
    return { day, focus: f, activity };
  });
  const development = [
    ...report.requirements.filter((r) => !r.met).slice(0, 3).map((r) => `حقّق: ${r.label} (الحالي: ${r.detail}).`),
    ...(weak[0] ? [`ارفع إتقان "${SKILL_LABELS[weak[0]].ar}" إلى 70 عبر ثلاث حالات متتالية.`] : []),
    "التزم بقاعدة: التوصية أولًا، ثم ثلاثة أسباب مرقّمة بالأرقام، ثم المخاطر والخطوات.",
  ];
  const focus = report.regression_detected
    ? "لاحظنا تراجعًا مؤقتًا؛ ركّز هذا الأسبوع على المراجعة الموجهة وحالة واحدة يوميًا بتركيز عالٍ."
    : "استمر بوتيرة ثابتة: حالة واحدة يوميًا مع مراجعة التقييم أهم من خمس حالات بلا مراجعة.";
  return { weekly, development, focus };
}

export function collectRecurringErrors(feedbackGaps: string[][]): string[] {
  const counts = new Map<string, number>();
  for (const gaps of feedbackGaps.slice(0, 20)) {
    for (const g of gaps) {
      const k = g.slice(0, 60);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
}

export const STALE_DAYS = 14;

export function computeSkillBuckets(masteryMap: Partial<Record<SkillKey, number>>, masteryUpdated: Partial<Record<SkillKey, string>>, now = Date.now()) {
  const sorted = (Object.entries(masteryMap) as [SkillKey, number][]).sort((a, b) => b[1] - a[1]);
  const strong = sorted.filter(([, s]) => s >= 70).slice(0, 3).map(([k]) => k);
  const weak = [...sorted].reverse().filter(([, s]) => s < 70).slice(0, 3).map(([k]) => k);
  const stale = SKILLS.filter((s) => {
    const u = masteryUpdated[s];
    return !u || now - new Date(u).getTime() > STALE_DAYS * 86400000;
  });
  return { strong, weak, stale };
}

/** درجة تغطية تقريبية لإجابة الحالة التطبيقية مقابل الإجابة المعيارية (حتمية) */
export function coverageScore(modelAnswer: string, answer: string, tokenizeFn: (t: string) => string[]): number {
  const need = new Set(tokenizeFn(modelAnswer));
  const have = new Set(tokenizeFn(answer));
  if (need.size === 0) return 0;
  let hit = 0;
  for (const t of need) if (have.has(t)) hit++;
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const lengthFactor = Math.min(1, words / 80);
  return Math.round(Math.min(100, (hit / need.size) * 160) * lengthFactor);
}
