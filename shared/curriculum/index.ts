// ============================================================
// المنهج التدريبي المضمَّن — 12 وحدة عبر أربعة مستويات
// يُستخدم: (1) لتوليد ترحيل التعبئة (seed) لقاعدة البيانات، (2) في الوضع التجريبي مباشرة
// المعرّفات ثابتة حتى تتطابق بين قاعدة البيانات والمحتوى المضمَّن
// ============================================================
import type { ModuleFull } from "../types.ts";
import { MODULE_01 } from "./module-01-problem-definition.ts";
import { MODULE_02 } from "./module-02-mece-issue-tree.ts";
import { MODULE_03 } from "./module-03-hypothesis-driven.ts";
import { MODULE_04 } from "./module-04-data-quality.ts";
import { MODULE_05 } from "./module-05-quantitative.ts";
import { MODULE_06 } from "./module-06-root-cause.ts";
import { MODULE_07 } from "./module-07-prioritization.ts";
import { MODULE_08 } from "./module-08-portfolio.ts";
import { MODULE_09 } from "./module-09-governance-risk.ts";
import { MODULE_10 } from "./module-10-pyramid-communication.ts";
import { MODULE_11 } from "./module-11-case-interview.ts";
import { MODULE_12 } from "./module-12-integrated-cases.ts";

export { buildModule, moduleId, questionId } from "./builder.ts";
export type { ModuleDefinition } from "./builder.ts";

export const CURRICULUM: ModuleFull[] = [
  MODULE_01,
  MODULE_02,
  MODULE_03,
  MODULE_04,
  MODULE_05,
  MODULE_06,
  MODULE_07,
  MODULE_08,
  MODULE_09,
  MODULE_10,
  MODULE_11,
  MODULE_12,
];

export function findModule(id: string): ModuleFull | undefined {
  return CURRICULUM.find((m) => m.id === id || m.slug === id);
}
