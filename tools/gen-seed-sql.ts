// ============================================================
// يولّد ترحيل تعبئة المنهج (0006_seed_curriculum.sql) من المحتوى المضمَّن + قوالب Prompts المضمَّنة
// التشغيل: node tools/gen-seed-sql.ts
// ============================================================
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CURRICULUM } from "../shared/curriculum/index.ts";
import { BUILTIN_PROMPTS, PROMPT_KEYS } from "../shared/prompts/index.ts";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "supabase", "migrations", "0006_seed_curriculum.sql");

function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function jsonb(v: unknown): string {
  return `${lit(JSON.stringify(v))}::jsonb`;
}

const lines: string[] = [];
lines.push("-- ============================================================");
lines.push("-- 0006: تعبئة المنهج التدريبي (12 وحدة + بنك الأسئلة) وقوالب Prompts المضمَّنة");
lines.push("-- ملف مولَّد آليًا من shared/curriculum عبر tools/gen-seed-sql.ts — لا تعدّله يدويًا");
lines.push("-- قابل لإعادة التنفيذ (upsert)");
lines.push("-- ============================================================");
lines.push("");

for (const m of CURRICULUM) {
  const content = { ...m.content, primary_skill: m.primary_skill };
  lines.push(
    `insert into academy.modules (id, slug, title, description, level, order_index, content, is_published) values (${lit(m.id)}, ${lit(m.slug)}, ${lit(m.title)}, ${lit(m.description)}, ${lit(m.level)}, ${m.order_index}, ${jsonb(content)}, true)`,
  );
  lines.push(
    `  on conflict (id) do update set slug = excluded.slug, title = excluded.title, description = excluded.description, level = excluded.level, order_index = excluded.order_index, content = excluded.content, is_published = excluded.is_published;`,
  );
  lines.push(
    `insert into academy.lessons (id, module_id, title, content, order_index) values (${lit(m.id.replace(/^00000000-0000-4000-8000-0000000000/, "00000000-0000-4000-8000-00000000ll").replace("ll", "11"))}, ${lit(m.id)}, ${lit("الدرس الأساسي: " + m.title)}, ${jsonb({ explanation: m.content.explanation, terms: m.content.terms, method_steps: m.content.method_steps })}, 1)`,
  );
  lines.push(`  on conflict (id) do update set title = excluded.title, content = excluded.content, order_index = excluded.order_index;`);
  for (const q of m.questions) {
    lines.push(
      `insert into academy.question_bank (id, module_id, skill, level, question_type, question, options, correct_answer, explanation, is_published) values (${lit(q.id)}, ${lit(m.id)}, ${lit(q.skill)}, ${lit(q.level)}, ${lit(q.question_type)}, ${lit(q.question)}, ${jsonb(q.options)}, ${jsonb(q.correct_answer ?? null)}, ${lit(q.explanation ?? "")}, true)`,
    );
    lines.push(
      `  on conflict (id) do update set skill = excluded.skill, level = excluded.level, question_type = excluded.question_type, question = excluded.question, options = excluded.options, correct_answer = excluded.correct_answer, explanation = excluded.explanation;`,
    );
  }
  lines.push("");
}

lines.push("-- قوالب Prompts المضمَّنة (غير نشطة افتراضيًا؛ الكود يستخدم الإصدار المضمَّن ما لم يُفعَّل إصدار من لوحة الإدارة)");
for (const k of PROMPT_KEYS) {
  const p = BUILTIN_PROMPTS[k];
  lines.push(`insert into academy.prompt_templates (key, version, content, is_active, notes) values (${lit(k)}, ${lit(p.version)}, ${lit(p.content)}, false, 'الإصدار المضمَّن في الكود')`);
  lines.push(`  on conflict (key, version) do update set content = excluded.content;`);
}
lines.push("");

writeFileSync(out, lines.join("\n"), "utf8");
console.log(`wrote ${out} (${CURRICULUM.length} modules, ${CURRICULUM.reduce((s, m) => s + m.questions.length, 0)} questions)`);
