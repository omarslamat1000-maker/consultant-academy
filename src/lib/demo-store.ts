// ============================================================
// مخزن الوضع التجريبي — localStorage (بيانات تجريبية محلية فقط)
// ============================================================
import type { AttemptRecord, CaseRecord, Level, LevelHistoryRecord, MasteryRecord, ProfileRecord, ProgressRecord, QuizAttemptRecord, ReviewCardRecord, SectorKey, SkillKey } from "../../shared/types.ts";

const KEY = "consultant-academy-demo-v1";
export const DEMO_USER_ID = "00000000-0000-4000-8000-00000000demo";

export interface DemoState {
  profile: ProfileRecord;
  progress: Record<string, ProgressRecord>;
  quiz_attempts: (QuizAttemptRecord & { applied_case_score: number | null })[];
  cases: CaseRecord[];
  attempts: AttemptRecord[];
  mastery: Record<string, MasteryRecord>;
  followups: { case_id: string; turn_index: number; question: string; answer: string; score_delta?: number; ai?: boolean }[];
  review_cards: ReviewCardRecord[];
  level_history: LevelHistoryRecord[];
}

function fresh(): DemoState {
  const now = new Date().toISOString();
  return {
    profile: { id: DEMO_USER_ID, display_name: "متدرب تجريبي", level: "beginner", preferred_sector: null, track: null, created_at: now, updated_at: now },
    progress: {},
    quiz_attempts: [],
    cases: [],
    attempts: [],
    mastery: {},
    followups: [],
    review_cards: [],
    level_history: [{ level: "beginner", achieved_at: now }],
  };
}

export function loadDemo(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed.profile) return fresh();
    return { ...fresh(), ...parsed };
  } catch {
    return fresh();
  }
}

export function saveDemo(state: DemoState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // تجاهل أخطاء التخزين (وضع خاص/امتلاء)
  }
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // تجاهل
  }
}

export function mutateDemo(fn: (s: DemoState) => void): DemoState {
  const s = loadDemo();
  fn(s);
  saveDemo(s);
  return s;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type { Level, SectorKey, SkillKey };
