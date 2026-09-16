// ============================================================
// مقارنة مجهولة الهوية بالأقران: نسب مئوية من توزيع درجات الإتقان (لا أسماء ولا معرفات)
// ============================================================
import { SKILLS, type SkillKey } from "./types.ts";

export const PEERS_MIN_COHORT = 3;

export interface PeerSkillComparison {
  skill: SkillKey;
  my_score: number | null;
  /** نسبة الأقران الذين درجتي ≥ درجتهم (0–100)؛ null إن لم تتوفر درجة لي أو كانت المجموعة صغيرة */
  percentile: number | null;
  median: number | null;
  cohort_size: number;
}

export interface PeerComparison {
  cohort_size: number;
  enough_data: boolean;
  skills: PeerSkillComparison[];
  overall_percentile: number | null;
  computed_locally?: boolean;
}

export function percentileOf(values: number[], mine: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v <= mine).length;
  return Math.round((below / values.length) * 100);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

/**
 * rows: كل درجات الإتقان في المنصة (user_id, skill, score) — تُجمَّع هنا ولا تُعاد للواجهة إلا كنسب.
 */
export function comparePeers(rows: { user_id: string; skill: string; score: number }[], myUserId: string): PeerComparison {
  const users = new Set(rows.map((r) => r.user_id));
  const cohort = users.size;
  const enough = cohort >= PEERS_MIN_COHORT;
  const skills: PeerSkillComparison[] = SKILLS.map((skill) => {
    const all = rows.filter((r) => r.skill === skill);
    const mine = all.find((r) => r.user_id === myUserId)?.score ?? null;
    const others = all.filter((r) => r.user_id !== myUserId).map((r) => Number(r.score));
    return {
      skill,
      my_score: mine === null ? null : Math.round(Number(mine)),
      percentile: enough && mine !== null && others.length > 0 ? percentileOf(others, Number(mine)) : null,
      median: enough ? median(all.map((r) => Number(r.score))) : null,
      cohort_size: all.length,
    };
  });
  // الترتيب العام: متوسط درجاتي مقابل متوسط كل مستخدم
  const avgByUser = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const a = avgByUser.get(r.user_id) ?? { sum: 0, n: 0 };
    a.sum += Number(r.score);
    a.n += 1;
    avgByUser.set(r.user_id, a);
  }
  const myAvg = avgByUser.get(myUserId);
  const otherAvgs = [...avgByUser.entries()].filter(([u]) => u !== myUserId).map(([, a]) => a.sum / a.n);
  const overall = enough && myAvg && otherAvgs.length > 0 ? percentileOf(otherAvgs, myAvg.sum / myAvg.n) : null;
  return { cohort_size: cohort, enough_data: enough, skills, overall_percentile: overall };
}
