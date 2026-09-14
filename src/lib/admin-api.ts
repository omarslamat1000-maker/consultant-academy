// ============================================================
// واجهات لوحة المسؤول (الوضع الكامل فقط) — عبر Functions أو Data API بسياسات RLS الإدارية
// ============================================================
import type { Level, QuizQuestion, Role } from "../../shared/types.ts";
import { apiFetch } from "./api.ts";
import { getSupabase } from "./supabase.ts";

export interface AdminUserRow {
  id: string;
  email: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  role: Role;
  display_name: string;
  level: Level;
  attempts: number;
  avg_score: number | null;
}

export const adminApi = {
  listUsers: (page = 1) => apiFetch<{ page: number; per_page: number; users: AdminUserRow[] }>("/api/admin/users", { body: { action: "list", page } }),
  setRole: (user_id: string, role: Role) => apiFetch<{ ok: true }>("/api/admin/users", { body: { action: "set_role", user_id, role } }),
  setLevel: (user_id: string, level: Level) => apiFetch<{ ok: true }>("/api/admin/users", { body: { action: "set_level", user_id, level } }),
  stats: () => apiFetch<any>("/api/admin/stats"),
  reviewCase: (case_id: string, review_status: "pending" | "approved" | "rejected", is_reference_example: boolean) =>
    apiFetch<any>("/api/admin/cases/review", { body: { case_id, review_status, is_reference_example } }),
  prompts: {
    list: () => apiFetch<{ builtin: { key: string; version: string; content: string }[]; custom: any[] }>("/api/admin/prompts", { body: { action: "list" } }),
    create: (key: string, version: string, content: string, notes: string) => apiFetch<any>("/api/admin/prompts", { body: { action: "create", key, version, content, notes } }),
    activate: (id: string) => apiFetch<any>("/api/admin/prompts", { body: { action: "activate", id } }),
    deactivate: (id: string) => apiFetch<any>("/api/admin/prompts", { body: { action: "deactivate", id } }),
  },
  provider: {
    status: () => apiFetch<any>("/api/ai-provider/status"),
    save: (body: { provider: "gemini"; api_key: string; model: string; temperature: number; max_output_tokens: number }) => apiFetch<any>("/api/ai-provider/save", { body }),
    test: (body: { provider: "gemini"; api_key?: string; model?: string }) => apiFetch<any>("/api/ai-provider/test", { body, timeoutMs: 40000 }),
    rotate: (id: string, api_key: string) => apiFetch<any>("/api/ai-provider/rotate", { body: { id, api_key } }),
    setActive: (id: string, enable: boolean) => apiFetch<any>("/api/ai-provider/disable", { body: { id, enable } }),
    remove: (id: string) => apiFetch<any>("/api/ai-provider/delete", { body: { id } }),
  },
  // إدارة المحتوى مباشرة عبر Data API (سياسات RLS الإدارية)
  modules: {
    list: async () => {
      const { data, error } = await getSupabase().from("modules").select("*").order("order_index");
      if (error) throw new Error("تعذر تحميل الوحدات.");
      return data as any[];
    },
    save: async (m: { id?: string; slug: string; title: string; description: string; level: Level; order_index: number; content: unknown; is_published: boolean }) => {
      const sb = getSupabase();
      const q = m.id ? sb.from("modules").update(m).eq("id", m.id) : sb.from("modules").insert(m);
      const { data, error } = await q.select("*").single();
      if (error) throw new Error(error.message.includes("duplicate") ? "المعرّف (slug) مستخدم مسبقًا." : "تعذر حفظ الوحدة.");
      return data;
    },
    remove: async (id: string) => {
      const { error } = await getSupabase().from("modules").delete().eq("id", id);
      if (error) throw new Error("تعذر حذف الوحدة.");
    },
  },
  questions: {
    list: async (moduleId: string) => {
      const { data, error } = await getSupabase().from("question_bank").select("*").eq("module_id", moduleId).order("created_at");
      if (error) throw new Error("تعذر تحميل الأسئلة.");
      return data as QuizQuestion[];
    },
    save: async (q: Partial<QuizQuestion> & { module_id: string; is_published?: boolean }) => {
      const sb = getSupabase();
      const { id, ...rest } = q;
      const qq = id ? sb.from("question_bank").update(rest).eq("id", id) : sb.from("question_bank").insert(rest);
      const { data, error } = await qq.select("*").single();
      if (error) throw new Error("تعذر حفظ السؤال: " + error.message);
      return data as QuizQuestion;
    },
    remove: async (id: string) => {
      const { error } = await getSupabase().from("question_bank").delete().eq("id", id);
      if (error) throw new Error("تعذر حذف السؤال.");
    },
  },
  cases: {
    listForReview: async (status: "pending" | "approved" | "rejected" | "all") => {
      let q = getSupabase().from("generated_cases").select("id, user_id, title, sector, skill, level, case_type, source, status, review_status, is_reference_example, similarity_score, prompt_version, created_at, content").eq("status", "active").eq("source", "ai").order("created_at", { ascending: false }).limit(100);
      if (status !== "all") q = q.eq("review_status", status);
      const { data, error } = await q;
      if (error) throw new Error("تعذر تحميل الحالات.");
      return data as any[];
    },
    attemptsForCase: async (caseId: string) => {
      const { data } = await getSupabase().from("attempts").select("id, score, human_score, evaluation_type, created_at, answer_text").eq("case_id", caseId).order("created_at", { ascending: false }).limit(20);
      return (data ?? []) as any[];
    },
    setHumanScore: async (attemptId: string, human_score: number | null) => {
      const { error } = await getSupabase().from("attempts").update({ human_score }).eq("id", attemptId);
      if (error) throw new Error("تعذر حفظ التقييم البشري.");
    },
  },
  audit: async () => {
    const { data, error } = await getSupabase().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("تعذر تحميل سجل العمليات.");
    return data as any[];
  },
};
