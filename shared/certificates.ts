// ============================================================
// شهادات إتمام المستوى: رمز تحقق قصير مشتق من (المستخدم، المستوى، تاريخ الإنجاز)
// الرمز للعرض والمطابقة اليدوية فقط (ليس توقيعًا مشفرًا)
// ============================================================
import { LEVEL_LABELS, LEVEL_ORDER, LEVELS, type Level, type LevelHistoryRecord } from "./types.ts";

export function certificateCode(userId: string, level: Level, achievedAt: string): string {
  const input = `${userId}:${level}:${achievedAt.slice(0, 10)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let h2 = 0x9747b28c;
  for (let i = input.length - 1; i >= 0; i--) {
    h2 ^= input.charCodeAt(i);
    h2 = Math.imul(h2, 0x5bd1e995) >>> 0;
  }
  return (h.toString(36) + h2.toString(36)).toUpperCase().slice(0, 10).padEnd(10, "0");
}

export interface CertificateInfo {
  level: Level;
  label: string;
  /** المستوى الذي أُتمّ (الشهادة تُمنح عند الوصول إلى المستوى التالي) */
  completed_level: Level;
  completed_label: string;
  achieved_at: string;
  code: string;
}

/**
 * الشهادة تُمنح لإتمام مستوى، أي عند تسجيل الوصول إلى المستوى الذي يليه.
 * سجل "beginner" هو تاريخ الانضمام ولا يمنح شهادة.
 */
export function certificatesFromHistory(userId: string, history: LevelHistoryRecord[]): CertificateInfo[] {
  return history
    .filter((h) => LEVEL_ORDER[h.level] > 0)
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
    .map((h) => {
      const completed = LEVELS[LEVEL_ORDER[h.level] - 1];
      return {
        level: h.level,
        label: LEVEL_LABELS[h.level],
        completed_level: completed,
        completed_label: LEVEL_LABELS[completed],
        achieved_at: h.achieved_at,
        code: certificateCode(userId, h.level, h.achieved_at),
      };
    });
}
