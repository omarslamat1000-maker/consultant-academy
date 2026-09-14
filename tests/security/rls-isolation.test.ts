// ============================================================
// اختبارات عزل RLS على قاعدة بيانات حقيقية — تعمل فقط عند ضبط متغيرات البيئة:
//   TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY,
//   TEST_USER_A_EMAIL/TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL/TEST_USER_B_PASSWORD
// (مستخدمان متدربان مؤكدان). راجع docs/SUPABASE_SETUP.md
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const anon = process.env.TEST_SUPABASE_ANON_KEY;
const aEmail = process.env.TEST_USER_A_EMAIL;
const aPass = process.env.TEST_USER_A_PASSWORD;
const bEmail = process.env.TEST_USER_B_EMAIL;
const bPass = process.env.TEST_USER_B_PASSWORD;
const enabled = Boolean(url && anon && aEmail && aPass && bEmail && bPass);

describe.skipIf(!enabled)("RLS — عزل بيانات المستخدمين (قاعدة حقيقية)", () => {
  async function login(email: string, password: string) {
    const c = createClient(url!, anon!, { db: { schema: "academy" }, auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { c, uid: data.user!.id };
  }

  it("anon لا يقرأ أي جدول", async () => {
    const c = createClient(url!, anon!, { db: { schema: "academy" } });
    for (const t of ["profiles", "attempts", "generated_cases", "mastery_scores", "ai_providers", "audit_logs", "question_bank"]) {
      const { data, error } = await c.from(t).select("*").limit(1);
      expect(error, t).not.toBeNull();
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("المستخدم يرى ملفه فقط ولا يرى ملف الآخر", async () => {
    const a = await login(aEmail!, aPass!);
    const b = await login(bEmail!, bPass!);
    const { data: mine } = await a.c.from("profiles").select("id");
    expect(mine?.map((r) => r.id)).toEqual([a.uid]);
    const { data: other } = await a.c.from("profiles").select("id").eq("id", b.uid);
    expect(other).toHaveLength(0);
  });

  it("المستخدم لا يرى محاولات ولا حالات الآخر، ولا يستطيع الكتابة مباشرة", async () => {
    const a = await login(aEmail!, aPass!);
    const b = await login(bEmail!, bPass!);
    const { data: bAttempts } = await a.c.from("attempts").select("id").eq("user_id", b.uid);
    expect(bAttempts).toHaveLength(0);
    const { error: insErr } = await a.c.from("attempts").insert({ user_id: a.uid, answer_text: "x", score: 100 });
    expect(insErr).not.toBeNull();
    const { error: caseErr } = await a.c.from("generated_cases").insert({ user_id: a.uid, fingerprint: "f", title: "t", sector: "government", skill: "structuring", level: "beginner", content: {}, prompt_version: "v" });
    expect(caseErr).not.toBeNull();
  });

  it("المستخدم لا يستطيع رفع مستواه بنفسه", async () => {
    const a = await login(aEmail!, aPass!);
    const { error } = await a.c.from("profiles").update({ level: "advanced_expert" }).eq("id", a.uid);
    expect(error).not.toBeNull();
  });

  it("بنك الأسئلة الكامل (مع الإجابات) غير متاح للمتدرب؛ العرض العام بلا إجابات", async () => {
    const a = await login(aEmail!, aPass!);
    const { data: full } = await a.c.from("question_bank").select("*").limit(1);
    expect(full ?? []).toHaveLength(0);
    const { data: pub } = await a.c.from("question_bank_public").select("*").limit(1);
    if (pub && pub[0]) {
      expect(pub[0]).not.toHaveProperty("correct_answer");
      expect(pub[0]).not.toHaveProperty("explanation");
    }
  });

  it("جدول مفاتيح الذكاء الاصطناعي وسجل العمليات محجوبان عن المتدرب", async () => {
    const a = await login(aEmail!, aPass!);
    const { error: e1 } = await a.c.from("ai_providers").select("*");
    expect(e1).not.toBeNull();
    const { data: logs } = await a.c.from("audit_logs").select("*").limit(1);
    expect(logs ?? []).toHaveLength(0);
    const { data: prov } = await a.c.from("ai_providers_public").select("*");
    expect(prov ?? []).toHaveLength(0);
  });
});

describe.skipIf(enabled)("RLS (متخطى)", () => {
  it("يتطلب متغيرات بيئة الاختبار — راجع docs/SUPABASE_SETUP.md", () => {
    expect(true).toBe(true);
  });
});
