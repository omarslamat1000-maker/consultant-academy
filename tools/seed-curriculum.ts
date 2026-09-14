// ============================================================
// تعبئة المنهج عبر Data API بحساب مسؤول (بديل عن تنفيذ 0006_seed_curriculum.sql يدويًا)
// لا يحتاج service_role: يسجل الدخول بحساب مسؤول ويعتمد على سياسات RLS الإدارية
// التشغيل: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node tools/seed-curriculum.ts
// (يقرأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY من .env)
// ============================================================
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CURRICULUM } from "../shared/curriculum/index.ts";
import { BUILTIN_PROMPTS, PROMPT_KEYS } from "../shared/prompts/index.ts";

const root = resolve(import.meta.dirname, "..");
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!url || !anon || !email || !password) {
  console.error("يلزم: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD");
  process.exit(1);
}

const sb = createClient(url, anon, { db: { schema: "academy" }, auth: { persistSession: false } });
const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error("فشل تسجيل الدخول:", authErr.message);
  process.exit(1);
}

let modulesN = 0;
let questionsN = 0;
for (const m of CURRICULUM) {
  const { error } = await sb.from("modules").upsert(
    { id: m.id, slug: m.slug, title: m.title, description: m.description, level: m.level, order_index: m.order_index, content: { ...m.content, primary_skill: m.primary_skill }, is_published: true },
    { onConflict: "id" },
  );
  if (error) {
    console.error(`module ${m.slug}:`, error.message);
    process.exit(1);
  }
  modulesN++;
  const lessonId = m.id.replace(/^00000000-0000-4000-8000-0000000000/, "00000000-0000-4000-8000-0000000011");
  await sb.from("lessons").upsert({ id: lessonId, module_id: m.id, title: `الدرس الأساسي: ${m.title}`, content: { explanation: m.content.explanation, terms: m.content.terms, method_steps: m.content.method_steps }, order_index: 1 }, { onConflict: "id" });
  const rows = m.questions.map((q) => ({ id: q.id, module_id: m.id, skill: q.skill, level: q.level, question_type: q.question_type, question: q.question, options: q.options, correct_answer: q.correct_answer ?? null, explanation: q.explanation ?? "", is_published: true }));
  const { error: qErr } = await sb.from("question_bank").upsert(rows, { onConflict: "id" });
  if (qErr) {
    console.error(`questions ${m.slug}:`, qErr.message);
    process.exit(1);
  }
  questionsN += rows.length;
}
for (const k of PROMPT_KEYS) {
  const p = BUILTIN_PROMPTS[k];
  const { error } = await sb.from("prompt_templates").upsert({ key: k, version: p.version, content: p.content, is_active: false, notes: "الإصدار المضمَّن في الكود" }, { onConflict: "key,version" });
  if (error) console.warn(`prompt ${k}:`, error.message);
}
console.log(`✓ تمت تعبئة ${modulesN} وحدة و${questionsN} سؤالًا وقوالب Prompts المضمَّنة.`);
