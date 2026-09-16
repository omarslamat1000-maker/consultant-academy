// ============================================================
// طبقة البيانات الموحدة: تنفيذ كامل (Supabase + Functions) وتنفيذ تجريبي (محلي)
// ============================================================
import type { EvaluateOutcome, FollowUpOutcome, GenerateOutcome, PeerComparison, QuizOutcome, RecommendationBundle, RevealOutcome, ReviewDueOutcome, ReviewGradeOutcome } from "../../shared/api-types.ts";
import { applyDialogue } from "../../shared/dialogue.ts";
import { comparePeers } from "../../shared/peers.ts";
import { gradeQuestion, stripAnswers } from "../../shared/quiz-grader.ts";
import { isMastered, newCardState, nextReviewState } from "../../shared/review.ts";
import { toPublicView } from "../../shared/case-view.ts";
import { CURRICULUM, findModule } from "../../shared/curriculum/index.ts";
import { CASE_LIBRARY, getLibraryCase } from "../../shared/cases/index.ts";
import { buildSemanticSignature, checkDuplicate, computeFingerprint, tokenize } from "../../shared/fingerprint.ts";
import { localEvaluate } from "../../shared/local-evaluator.ts";
import { masteryUpdatesFromEvaluation, updateMastery } from "../../shared/mastery.ts";
import { gradeQuiz } from "../../shared/quiz-grader.ts";
import { coverageScore } from "../../shared/recommendation-engine.ts";
import type { EvaluateRequest, FollowUpRequest, GenerateCaseRequest } from "../../shared/schemas.ts";
import { buildLocalRecommendation } from "../../shared/recommendation-local.ts";
import { LEVELS, LEVEL_ORDER, type AttemptRecord, type CaseContent, type CasePublicView, type CaseRecord, type Level, type MasteryRecord, type ModuleFull, type ModuleSummary, type LevelHistoryRecord, type ProfileRecord, type ProgressRecord, type QuizAttemptRecord, type QuizQuestion, type QuizUserAnswer, type ReviewCardRecord, type Role, type SectorKey, type SemanticSignature, type SkillKey, type TrackKey } from "../../shared/types.ts";
import { ApiClientError, apiFetch } from "./api.ts";
import { IS_DEMO } from "./config.ts";
import { DEMO_USER_ID, loadDemo, mutateDemo, uuid } from "./demo-store.ts";
import { getSupabase } from "./supabase.ts";

export interface AttemptListItem extends AttemptRecord {
  case_title: string;
  skill: SkillKey | null;
  level: Level | null;
  sector: SectorKey | null;
}

export interface DataService {
  readonly mode: "demo" | "full";
  getProfile(): Promise<{ profile: ProfileRecord; role: Role }>;
  updateProfile(p: ProfileUpdate): Promise<ProfileRecord>;
  listModules(): Promise<{ modules: ModuleSummary[]; progress: Record<string, ProgressRecord> }>;
  getModule(id: string): Promise<{ module: ModuleFull; progress: ProgressRecord | null; quiz_history: QuizAttemptRecord[] }>;
  submitQuiz(moduleId: string, answers: Record<string, QuizUserAnswer>, appliedAnswer: string | undefined, durationSeconds: number): Promise<QuizOutcome>;
  generateCase(req: GenerateCaseRequest): Promise<GenerateOutcome>;
  revealData(caseId: string, key: string): Promise<RevealOutcome>;
  evaluate(req: EvaluateRequest): Promise<EvaluateOutcome>;
  followUp(req: FollowUpRequest): Promise<FollowUpOutcome>;
  getCase(id: string): Promise<CasePublicView>;
  listAttempts(): Promise<AttemptListItem[]>;
  getMastery(): Promise<MasteryRecord[]>;
  getRecommendation(): Promise<RecommendationBundle>;
  aiStatus(): Promise<{ configured: boolean }>;
  /** بطاقات المراجعة المتباعدة المستحقة */
  listReviewDue(): Promise<ReviewDueOutcome>;
  gradeReview(cardId: string, answer: QuizUserAnswer): Promise<ReviewGradeOutcome>;
  /** مقارنة مجهولة بالأقران (نسب فقط) */
  getPeerComparison(): Promise<PeerComparison>;
  /** سجل الترقيات (أساس الشهادات) */
  listLevelHistory(): Promise<LevelHistoryRecord[]>;
}

export interface ProfileUpdate {
  display_name?: string;
  preferred_sector?: SectorKey | null;
  track?: TrackKey | null;
}

// ============================================================
// التنفيذ الكامل
// ============================================================
class FullDataService implements DataService {
  readonly mode = "full" as const;

  private async uid(): Promise<string> {
    const { data } = await getSupabase().auth.getUser();
    if (!data.user) throw new Error("يلزم تسجيل الدخول.");
    return data.user.id;
  }

  async getProfile() {
    const sb = getSupabase();
    const uid = await this.uid();
    const [{ data: profile, error }, { data: roleRow }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    if (error) throw new Error("تعذر تحميل الملف الشخصي.");
    const now = new Date().toISOString();
    return {
      profile: (profile as ProfileRecord | null) ?? { id: uid, display_name: "", level: "beginner", preferred_sector: null, created_at: now, updated_at: now },
      role: ((roleRow?.role as Role | undefined) ?? "learner") as Role,
    };
  }

  async updateProfile(p: ProfileUpdate) {
    const sb = getSupabase();
    const uid = await this.uid();
    const { data, error } = await sb.from("profiles").update(p).eq("id", uid).select("*").single();
    if (error) throw new Error("تعذر حفظ الملف الشخصي.");
    return data as ProfileRecord;
  }

  async listModules() {
    const sb = getSupabase();
    const uid = await this.uid();
    const [{ data: mods, error }, { data: prog }] = await Promise.all([
      sb.from("modules").select("id, slug, title, description, level, order_index, is_published, content").order("order_index"),
      sb.from("learning_progress").select("module_id, best_score, attempts_count, completed, last_activity_at").eq("user_id", uid),
    ]);
    if (error) throw new Error("تعذر تحميل الوحدات.");
    const modules: ModuleSummary[] = (mods ?? []).map((m: any) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      level: m.level,
      order_index: m.order_index,
      is_published: m.is_published,
      primary_skill: m.content?.primary_skill ?? "problem_definition",
    }));
    const progress: Record<string, ProgressRecord> = {};
    for (const p of (prog ?? []) as any[]) progress[p.module_id] = { module_id: p.module_id, best_score: Number(p.best_score), attempts_count: p.attempts_count, completed: p.completed, last_activity_at: p.last_activity_at };
    return { modules, progress };
  }

  async getModule(id: string) {
    const sb = getSupabase();
    const uid = await this.uid();
    const [{ data: m, error }, { data: qs }, { data: prog }, { data: hist }] = await Promise.all([
      sb.from("modules").select("*").eq("id", id).maybeSingle(),
      sb.from("question_bank_public").select("*").eq("module_id", id).order("created_at"),
      sb.from("learning_progress").select("*").eq("user_id", uid).eq("module_id", id).maybeSingle(),
      sb.from("quiz_attempts").select("id, module_id, score, created_at").eq("user_id", uid).eq("module_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (error || !m) throw new Error("الوحدة غير موجودة.");
    const module: ModuleFull = {
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      level: m.level,
      order_index: m.order_index,
      is_published: m.is_published,
      primary_skill: m.content?.primary_skill ?? "problem_definition",
      content: m.content,
      questions: (qs ?? []) as any[],
    };
    return {
      module,
      progress: prog ? { module_id: prog.module_id, best_score: Number(prog.best_score), attempts_count: prog.attempts_count, completed: prog.completed, last_activity_at: prog.last_activity_at } : null,
      quiz_history: ((hist ?? []) as any[]).map((h) => ({ id: h.id, module_id: h.module_id, score: Number(h.score), created_at: h.created_at })),
    };
  }

  submitQuiz(moduleId: string, answers: Record<string, QuizUserAnswer>, appliedAnswer: string | undefined, durationSeconds: number) {
    return apiFetch<QuizOutcome>("/api/quiz/submit", { body: { module_id: moduleId, answers, applied_case_answer: appliedAnswer || undefined, duration_seconds: durationSeconds } });
  }
  generateCase(req: GenerateCaseRequest) {
    return apiFetch<GenerateOutcome>("/api/cases/generate", { body: req, timeoutMs: 120000 });
  }
  revealData(caseId: string, key: string) {
    return apiFetch<RevealOutcome>("/api/cases/reveal", { body: { case_id: caseId, key } });
  }
  evaluate(req: EvaluateRequest) {
    return apiFetch<EvaluateOutcome>("/api/cases/evaluate", { body: req, timeoutMs: 120000 });
  }
  followUp(req: FollowUpRequest) {
    return apiFetch<FollowUpOutcome>("/api/cases/follow-up", { body: req, timeoutMs: 90000 });
  }

  async getCase(id: string) {
    const { data, error } = await getSupabase().from("generated_cases").select("*").eq("id", id).maybeSingle();
    if (error || !data) throw new Error("الحالة غير موجودة.");
    return toPublicView(data as CaseRecord);
  }

  async listAttempts() {
    const sb = getSupabase();
    const uid = await this.uid();
    const { data, error } = await sb.from("attempts").select("*, case:generated_cases(title, skill, level, sector)").eq("user_id", uid).order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error("تعذر تحميل السجل.");
    return ((data ?? []) as any[]).map((a) => ({
      ...a,
      score: Number(a.score),
      case_title: a.case?.title ?? "حالة محذوفة",
      skill: a.case?.skill ?? null,
      level: a.case?.level ?? null,
      sector: a.case?.sector ?? null,
    })) as AttemptListItem[];
  }

  async getMastery() {
    const sb = getSupabase();
    const uid = await this.uid();
    const { data, error } = await sb.from("mastery_scores").select("skill, score, evidence_count, updated_at").eq("user_id", uid);
    if (error) throw new Error("تعذر تحميل درجات الإتقان.");
    return ((data ?? []) as any[]).map((m) => ({ ...m, score: Number(m.score) })) as MasteryRecord[];
  }

  async getRecommendation(): Promise<RecommendationBundle> {
    try {
      return await apiFetch<RecommendationBundle>("/api/recommendations/next", { method: "POST", body: {}, timeoutMs: 60000 });
    } catch (err) {
      // الوظائف الخادمية غير متاحة: نحسب التوصية محليًا من بيانات المستخدم عبر Data API (بلا ترقية ولا خطة ذكية)
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403 || err.status === 429)) throw err;
      const sb = getSupabase();
      const uid = await this.uid();
      const [{ data: profile }, { data: mods }, { data: prog }, { data: quizzes }, { data: attempts }, { data: mastery }, { data: cases }] = await Promise.all([
        sb.from("profiles").select("level, preferred_sector, track").eq("id", uid).maybeSingle(),
        sb.from("modules").select("id, title, level, order_index, content").eq("is_published", true).order("order_index"),
        sb.from("learning_progress").select("module_id, best_score, attempts_count, completed, last_activity_at").eq("user_id", uid),
        sb.from("quiz_attempts").select("id, module_id, score, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
        sb.from("attempts").select("case_id, case_fingerprint, score, duration_seconds, created_at, feedback").eq("user_id", uid).order("created_at", { ascending: false }).limit(300),
        sb.from("mastery_scores").select("skill, score, evidence_count, updated_at").eq("user_id", uid),
        sb.from("generated_cases").select("id, level, sector").eq("user_id", uid).eq("status", "active"),
      ]);
      const bundle = buildLocalRecommendation({
        level: (profile?.level as Level) ?? "beginner",
        preferred_sector: (profile?.preferred_sector as SectorKey | null) ?? null,
        track: (profile?.track as TrackKey | null) ?? null,
        modules: ((mods ?? []) as any[]).map((m) => ({ id: m.id, title: m.title, level: m.level, order_index: m.order_index, primary_skill: m.content?.primary_skill })),
        progress: ((prog ?? []) as any[]).map((p) => ({ ...p, best_score: Number(p.best_score) })),
        quiz_attempts: ((quizzes ?? []) as any[]).map((q) => ({ ...q, score: Number(q.score) })),
        attempts: ((attempts ?? []) as any[]).map((a) => ({ ...a, score: Number(a.score) })),
        mastery: ((mastery ?? []) as any[]).map((m) => ({ ...m, score: Number(m.score) })),
        cases: (cases ?? []) as any[],
      });
      return { ...bundle, computed_locally: true };
    }
  }
  aiStatus() {
    return apiFetch<{ configured: boolean }>("/api/ai-provider/status");
  }
  listReviewDue() {
    return apiFetch<ReviewDueOutcome>("/api/review/due", { method: "POST", body: {} });
  }
  gradeReview(cardId: string, answer: QuizUserAnswer) {
    return apiFetch<ReviewGradeOutcome>("/api/review/grade", { body: { card_id: cardId, answer } });
  }
  getPeerComparison() {
    return apiFetch<PeerComparison>("/api/peers/compare", { method: "POST", body: {} });
  }
  async listLevelHistory() {
    const sb = getSupabase();
    const uid = await this.uid();
    const { data, error } = await sb.from("level_history").select("level, achieved_at").eq("user_id", uid).order("achieved_at");
    if (error) throw new Error("تعذر تحميل سجل الترقيات.");
    return (data ?? []) as LevelHistoryRecord[];
  }
}

// ============================================================
// التنفيذ التجريبي (محلي — لا يدّعي أنه ذكاء اصطناعي)
// ============================================================
class DemoDataService implements DataService {
  readonly mode = "demo" as const;

  async getProfile() {
    return { profile: loadDemo().profile, role: "learner" as Role };
  }
  async updateProfile(p: ProfileUpdate) {
    const s = mutateDemo((st) => {
      Object.assign(st.profile, p, { updated_at: new Date().toISOString() });
    });
    return s.profile;
  }
  async listModules() {
    const s = loadDemo();
    return {
      modules: CURRICULUM.map(({ questions: _q, content: _c, ...rest }) => {
        void _q;
        void _c;
        return rest;
      }),
      progress: s.progress,
    };
  }
  async getModule(id: string) {
    const module = findModule(id);
    if (!module) throw new Error("الوحدة غير موجودة.");
    const s = loadDemo();
    return {
      module,
      progress: s.progress[module.id] ?? null,
      quiz_history: s.quiz_attempts.filter((q) => q.module_id === module.id).slice().reverse().slice(0, 20),
    };
  }
  async submitQuiz(moduleId: string, answers: Record<string, QuizUserAnswer>, appliedAnswer: string | undefined, durationSeconds: number): Promise<QuizOutcome> {
    const module = findModule(moduleId);
    if (!module) throw new Error("الوحدة غير موجودة.");
    const result = gradeQuiz(module.questions, answers);
    const quizMin = module.content.completion_rule.quiz_min_score;
    const appliedMin = module.content.completion_rule.applied_case_min_score;
    const passed = result.score >= quizMin;
    const appliedScore = appliedAnswer && appliedAnswer.length >= 40 ? coverageScore(module.content.applied_case.model_answer, appliedAnswer, tokenize) : null;
    const appliedPassed = appliedScore !== null && appliedScore >= appliedMin;
    let outcome!: QuizOutcome;
    let reviewCreated = 0;
    mutateDemo((st) => {
      const prev = st.progress[moduleId];
      const best = Math.max(prev?.best_score ?? 0, result.score);
      const attemptsCount = (prev?.attempts_count ?? 0) + 1;
      const completed = Boolean(prev?.completed) || (passed && appliedPassed);
      st.progress[moduleId] = { module_id: moduleId, best_score: best, attempts_count: attemptsCount, completed, last_activity_at: new Date().toISOString() };
      st.quiz_attempts.push({ id: uuid(), module_id: moduleId, score: result.score, created_at: new Date().toISOString(), applied_case_score: appliedScore });
      void durationSeconds;
      // بطاقات المراجعة المتباعدة للأسئلة الخاطئة
      for (const g of result.graded.filter((x) => !x.correct)) {
        const state = newCardState();
        const existing = st.review_cards.find((c) => c.question_id === g.question_id);
        if (existing) Object.assign(existing, { due_at: state.due_at, interval_days: 1, streak: 0, last_result: false });
        else st.review_cards.push({ id: uuid(), question_id: g.question_id, ...state });
        reviewCreated++;
      }
      const combined = appliedScore === null ? result.score : Math.round((result.score * 0.6 + appliedScore * 0.4) * 100) / 100;
      const prevM = st.mastery[module.primary_skill];
      const next = updateMastery(prevM ? { score: prevM.score, evidence_count: prevM.evidence_count } : null, combined);
      st.mastery[module.primary_skill] = { skill: module.primary_skill, score: next.score, evidence_count: next.evidence_count, updated_at: new Date().toISOString() };
      outcome = { result, applied_case_score: appliedScore, applied_case_min: appliedMin, quiz_min: quizMin, best_score: best, attempts_count: attemptsCount, completed, passed, mastery: { skill: module.primary_skill, ...next }, review_cards_created: reviewCreated };
    });
    return outcome;
  }

  async generateCase(req: GenerateCaseRequest): Promise<GenerateOutcome> {
    const s = loadDemo();
    if (req.allow_repeat_case_id) {
      const row = s.cases.find((c) => c.id === req.allow_repeat_case_id);
      if (!row) throw new Error("الحالة غير موجودة.");
      return { case: toPublicView(row), attempts: 0, duplicates_rejected: 0, ai: false, message: "أُعيدت حالة سابقة بناءً على طلبك الصريح." };
    }
    const userLevel = s.profile.level;
    const maxIdx = Math.min(LEVELS.length - 1, LEVEL_ORDER[userLevel] + 1);
    const level: Level = req.level && LEVEL_ORDER[req.level] <= maxIdx ? req.level : userLevel;
    const seen = new Set(s.cases.filter((c) => c.status === "active").map((c) => c.fingerprint));
    let chosen: { c: CaseContent; sig: SemanticSignature; fp: string };
    let libraryMessage: string | null = null;
    if (req.library_id) {
      const found = getLibraryCase(req.library_id);
      if (!found) throw new Error("حالة المكتبة غير موجودة.");
      if (LEVEL_ORDER[found.level] > maxIdx) throw new Error("هذه الحالة أعلى من مستواك الحالي بأكثر من درجة واحدة.");
      const sig = buildSemanticSignature(found);
      chosen = { c: found, sig, fp: computeFingerprint(sig) };
      libraryMessage = seen.has(chosen.fp) ? "بدأتَ حالة من المكتبة سبق أن تدربت عليها؛ ستُحتسب المحاولة لكن لا تُعد حالة فريدة جديدة." : "حالة من المكتبة الداخلية (مكتوبة يدويًا، غير مولدة).";
    } else {
      const candidates = CASE_LIBRARY.map((c) => ({ c, sig: buildSemanticSignature(c) }))
        .map((x) => ({ ...x, fp: computeFingerprint(x.sig) }))
        .filter((x) => !seen.has(x.fp));
      if (candidates.length === 0) throw new Error("استُنفدت حالات المكتبة الداخلية في الوضع التجريبي. اربط Supabase وGemini للحصول على حالات مولدة جديدة، أو أعد حالة سابقة من السجل.");
      const score = (c: CaseContent) => (c.level === level ? 2 : 0) + (req.skill && c.skill === req.skill ? 1 : 0) + (req.sector && c.sector === req.sector ? 1 : 0);
      candidates.sort((a, b) => score(b.c) - score(a.c));
      chosen = candidates[0];
    }
    const caseType = req.case_type ?? "candidate_led";
    const content: CaseContent = { ...chosen.c, case_type: caseType };
    const recent = s.cases.slice().reverse().map((c) => ({ fingerprint: c.fingerprint, signature: c.semantic_signature }));
    const dup = checkDuplicate(chosen.sig, chosen.fp, recent);
    const row: CaseRecord = {
      id: uuid(),
      user_id: DEMO_USER_ID,
      fingerprint: chosen.fp,
      semantic_signature: chosen.sig,
      title: content.title,
      sector: content.sector,
      skill: content.skill,
      level: content.level,
      case_type: caseType,
      content,
      prompt_version: req.library_id ? "library-v1" : "static-v1",
      similarity_score: dup.max_similarity,
      status: "active",
      review_status: "approved",
      is_reference_example: false,
      source: "static",
      last_shown_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    mutateDemo((st) => st.cases.push(row));
    return { case: toPublicView(row), attempts: 1, duplicates_rejected: 0, ai: false, message: libraryMessage ?? "الوضع التجريبي: حالة من المكتبة الداخلية (مكتوبة يدويًا، وليست مولدة بالذكاء الاصطناعي)." };
  }

  async revealData(caseId: string, key: string): Promise<RevealOutcome> {
    const row = loadDemo().cases.find((c) => c.id === caseId);
    const item = row?.content.hidden_data.find((h) => h.key === key);
    if (!item) throw new Error("عنصر البيانات غير موجود.");
    return { key: item.key, label: item.label, value: item.value, unit: item.unit ?? null };
  }

  async evaluate(req: EvaluateRequest): Promise<EvaluateOutcome> {
    const s = loadDemo();
    const row = s.cases.find((c) => c.id === req.case_id);
    if (!row) throw new Error("الحالة غير موجودة.");
    const turns = s.followups.filter((f) => f.case_id === row.id).map((f) => ({ score_delta: f.score_delta ?? 0, ai: Boolean(f.ai) }));
    const evaluation = applyDialogue(localEvaluate(row.content, req.answer_text), turns.length ? turns : req.followup_answers.map(() => ({ score_delta: 0, ai: false })));
    const attempt: AttemptRecord = {
      id: uuid(),
      user_id: DEMO_USER_ID,
      case_id: row.id,
      case_fingerprint: row.fingerprint,
      answer_text: req.answer_text,
      score: evaluation.total_score,
      dimension_scores: evaluation.dimension_scores,
      feedback: evaluation,
      evaluation_type: "local",
      human_score: null,
      duration_seconds: req.duration_seconds ?? 0,
      created_at: new Date().toISOString(),
    };
    const updates = masteryUpdatesFromEvaluation(row.content.skill, evaluation.total_score, evaluation.dimension_scores);
    const masteryUpdates: EvaluateOutcome["mastery_updates"] = [];
    mutateDemo((st) => {
      st.attempts.push(attempt);
      for (const u of updates) {
        const prev = st.mastery[u.skill];
        const next = updateMastery(prev ? { score: prev.score, evidence_count: prev.evidence_count } : null, u.score);
        st.mastery[u.skill] = { skill: u.skill, score: next.score, evidence_count: next.evidence_count, updated_at: new Date().toISOString() };
        masteryUpdates.push({ skill: u.skill, ...next });
      }
    });
    return { attempt_id: attempt.id, evaluation, mastery_updates: masteryUpdates };
  }

  async followUp(req: FollowUpRequest): Promise<FollowUpOutcome> {
    const row = loadDemo().cases.find((c) => c.id === req.case_id);
    if (!row) throw new Error("الحالة غير موجودة.");
    const qs = row.content.interviewer_questions;
    const nextIdx = req.turn_index + 1;
    const next = qs[nextIdx] ?? null;
    mutateDemo((st) => st.followups.push({ case_id: row.id, turn_index: req.turn_index, question: qs[req.turn_index] ?? "", answer: req.previous_answer, score_delta: 0, ai: false }));
    return {
      assessment: "سُجّلت إجابتك. (الوضع التجريبي: متابعة ثابتة بلا تقييم ذكي؛ التقييم المحلي يظهر عند إرسال الإجابة النهائية.)",
      score_delta: 0,
      next_question: next,
      question_focus: "structure",
      pressure_level: nextIdx >= 3 ? "high" : nextIdx >= 1 ? "medium" : "low",
      is_final: next === null || nextIdx >= 5,
      hint: "",
      ai: false,
    };
  }

  async getCase(id: string) {
    const row = loadDemo().cases.find((c) => c.id === id);
    if (!row) throw new Error("الحالة غير موجودة.");
    return toPublicView(row);
  }

  async listAttempts() {
    const s = loadDemo();
    const caseMap = new Map(s.cases.map((c) => [c.id, c]));
    return s.attempts
      .slice()
      .reverse()
      .map((a) => {
        const c = a.case_id ? caseMap.get(a.case_id) : undefined;
        return { ...a, case_title: c?.title ?? "حالة محذوفة", skill: c?.skill ?? null, level: c?.level ?? null, sector: c?.sector ?? null };
      });
  }

  async getMastery() {
    return Object.values(loadDemo().mastery);
  }

  async getRecommendation(): Promise<RecommendationBundle> {
    const s = loadDemo();
    const attemptsNewest = s.attempts.slice().reverse();
    const bundle = buildLocalRecommendation({
      level: s.profile.level,
      preferred_sector: s.profile.preferred_sector,
      track: s.profile.track ?? null,
      modules: CURRICULUM.map((m) => ({ id: m.id, title: m.title, level: m.level, order_index: m.order_index, primary_skill: m.primary_skill })),
      progress: Object.values(s.progress),
      quiz_attempts: s.quiz_attempts.slice().reverse(),
      attempts: attemptsNewest,
      mastery: Object.values(s.mastery),
      cases: s.cases,
    });
    // في الوضع التجريبي تُطبَّق الترقية محليًا (لا خادم)
    let promotedTo: Level | null = null;
    if (bundle.level_report.eligible && bundle.level_report.next_level) {
      promotedTo = bundle.level_report.next_level;
      mutateDemo((st) => {
        st.profile.level = promotedTo as Level;
        if (!st.level_history.some((h) => h.level === promotedTo)) st.level_history.push({ level: promotedTo as Level, achieved_at: new Date().toISOString() });
      });
    }
    return { ...bundle, promoted_to: promotedTo };
  }

  async aiStatus() {
    return { configured: false };
  }

  private questionIndex(): Map<string, { q: QuizQuestion; module_id: string; module_title: string }> {
    const idx = new Map<string, { q: QuizQuestion; module_id: string; module_title: string }>();
    for (const m of CURRICULUM) for (const q of m.questions) idx.set(q.id, { q, module_id: m.id, module_title: m.title });
    return idx;
  }

  async listReviewDue(): Promise<ReviewDueOutcome> {
    const s = loadDemo();
    const idx = this.questionIndex();
    const now = Date.now();
    const due = s.review_cards.filter((c) => new Date(c.due_at).getTime() <= now).sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, 20);
    const views = due
      .map((card) => {
        const e = idx.get(card.question_id);
        if (!e) return null;
        return { card, question: stripAnswers([e.q])[0], module_id: e.module_id, module_title: e.module_title };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    return { due: views, total_cards: s.review_cards.length, due_count: s.review_cards.filter((c) => new Date(c.due_at).getTime() <= now).length, mastered_count: s.review_cards.filter(isMastered).length };
  }

  async gradeReview(cardId: string, answer: QuizUserAnswer): Promise<ReviewGradeOutcome> {
    const idx = this.questionIndex();
    let out!: ReviewGradeOutcome;
    mutateDemo((st) => {
      const card = st.review_cards.find((c) => c.id === cardId);
      if (!card) throw new Error("بطاقة المراجعة غير موجودة.");
      const e = idx.get(card.question_id);
      if (!e) throw new Error("السؤال غير موجود.");
      const graded = gradeQuestion(e.q, answer);
      const next = nextReviewState(card, graded.correct);
      Object.assign(card, next);
      const updated: ReviewCardRecord = { ...card };
      out = { graded, correct_answer: e.q.correct_answer ?? null, explanation: e.q.explanation ?? graded.explanation, card: updated };
    });
    return out;
  }

  async getPeerComparison(): Promise<PeerComparison> {
    // الوضع التجريبي: مجموعة أقران افتراضية حتمية (لا بيانات حقيقية) لتوضيح الميزة فقط
    const s = loadDemo();
    const rows: { user_id: string; skill: string; score: number }[] = Object.values(s.mastery).map((m) => ({ user_id: DEMO_USER_ID, skill: m.skill, score: m.score }));
    const skills = Object.keys(s.mastery);
    for (let u = 0; u < 12; u++) {
      for (const skill of skills) {
        const seed = (u * 131 + skill.length * 17 + skill.charCodeAt(0)) % 97;
        rows.push({ user_id: `peer-${u}`, skill, score: 35 + (seed % 55) });
      }
    }
    return { ...comparePeers(rows, DEMO_USER_ID), computed_locally: true };
  }

  async listLevelHistory(): Promise<LevelHistoryRecord[]> {
    return loadDemo().level_history.slice();
  }
}

export const data: DataService = IS_DEMO ? new DemoDataService() : new FullDataService();
