// ============================================================
// أدوات بناء الوحدات — منفصلة عن الفهرس لتجنب الاستيراد الدائري
// ============================================================
import type { Level, ModuleFull, QuizQuestion, SkillKey } from "../types.ts";

export function moduleId(n: number): string {
  return `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
}
export function questionId(moduleN: number, qN: number): string {
  return `00000000-0000-4000-8000-000000${String(moduleN).padStart(2, "0")}00${String(qN).padStart(2, "0")}`;
}

export interface ModuleDefinition {
  n: number;
  slug: string;
  title: string;
  description: string;
  level: Level;
  primary_skill: SkillKey;
  content: ModuleFull["content"];
  questions: Omit<QuizQuestion, "id" | "module_id" | "level">[];
}

export function buildModule(def: ModuleDefinition): ModuleFull {
  const id = moduleId(def.n);
  return {
    id,
    slug: def.slug,
    title: def.title,
    description: def.description,
    level: def.level,
    order_index: def.n,
    is_published: true,
    primary_skill: def.primary_skill,
    content: def.content,
    questions: def.questions.map((q, i) => ({ ...q, id: questionId(def.n, i + 1), module_id: id, level: def.level })),
  };
}
