import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EvaluateOutcome, GenerateOutcome, RevealOutcome } from "../../shared/api-types.ts";
import { CASE_TYPE_LABELS, CASE_TYPES, LEVELS, LEVEL_LABELS, LEVEL_ORDER, PERFORMANCE_LABELS, SECTORS, SECTOR_LABELS, SKILLS, SKILL_LABELS, type CasePublicView, type CaseType, type Level, type SectorKey, type SkillKey } from "../../shared/types.ts";
import { DimensionBars } from "../components/charts.tsx";
import { Alert, Badge, Card, Field, Loading, ScoreStamp } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { errorMessage } from "../lib/api.ts";
import { data } from "../lib/data.ts";

type Phase = "setup" | "generating" | "case" | "evaluating" | "result";

const REVEAL_STEPS = ["السياق", "المشكلة والقرار المطلوب", "الأهداف والقيود", "البيانات المتاحة"];

export function SimulatorPage() {
  const { profile, isDemo, role } = useAuth();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>("setup");
  const [level, setLevel] = useState<Level>((params.get("level") as Level) || profile?.level || "beginner");
  const [sector, setSector] = useState<SectorKey | "">((params.get("sector") as SectorKey) || "");
  const [skill, setSkill] = useState<SkillKey | "">((params.get("skill") as SkillKey) || "");
  const [caseType, setCaseType] = useState<CaseType>((params.get("type") as CaseType) || "candidate_led");
  const [timed, setTimed] = useState(params.get("timed") === "1");
  const [challenge, setChallenge] = useState<0 | 60 | 90>(0);
  const [gen, setGen] = useState<GenerateOutcome | null>(null);
  const [caseView, setCaseView] = useState<CasePublicView | null>(null);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState<RevealOutcome[]>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [result, setResult] = useState<EvaluateOutcome | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [chat, setChat] = useState<{ role: "interviewer" | "me"; text: string }[]>([]);
  const [followAnswer, setFollowAnswer] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [turn, setTurn] = useState(0);
  const [followDone, setFollowDone] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const startedAt = useRef<number>(0);
  const followups = useRef<{ question: string; answer: string }[]>([]);

  useEffect(() => {
    data
      .aiStatus()
      .then((s) => setAiConfigured(s.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const autoStarted = useRef(false);
  useEffect(() => {
    // حارس ضد التشغيل المزدوج في وضع React Strict (وإلا تُسجَّل الحالة مرتين)
    if (autoStarted.current) return;
    const repeat = params.get("repeat");
    const library = params.get("library");
    if (repeat && phase === "setup") {
      autoStarted.current = true;
      void start(repeat);
    } else if (library && phase === "setup") {
      autoStarted.current = true;
      void start(undefined, library);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "case") return;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const maxLevelIdx = role === "admin" ? LEVELS.length - 1 : Math.min(LEVELS.length - 1, LEVEL_ORDER[profile?.level ?? "beginner"] + 1);

  async function start(repeatId?: string, libraryId?: string) {
    setError(null);
    setPhase("generating");
    try {
      const r = await data.generateCase({
        level,
        sector: sector || undefined,
        skill: skill || undefined,
        case_type: caseType,
        timed,
        allow_repeat_case_id: repeatId,
        library_id: libraryId,
      });
      setGen(r);
      setCaseView(r.case);
      setStep(0);
      setRevealed([]);
      setAnswer("");
      setResult(null);
      setChat(r.case.case_type === "interviewer_led" && r.case.interviewer_questions[0] ? [{ role: "interviewer", text: r.case.interviewer_questions[0] }] : []);
      setTurn(0);
      setFollowDone(false);
      followups.current = [];
      startedAt.current = Date.now();
      setSeconds(0);
      setPhase("case");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("setup");
    }
  }

  async function reveal(key: string) {
    if (!caseView) return;
    try {
      const r = await data.revealData(caseView.id, key);
      setRevealed((s) => (s.some((x) => x.key === key) ? s : [...s, r]));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function sendFollowUp() {
    if (!caseView || !followAnswer.trim()) return;
    setFollowBusy(true);
    const lastQ = chat.filter((c) => c.role === "interviewer").slice(-1)[0]?.text ?? "";
    const myAnswer = followAnswer.trim();
    setChat((c) => [...c, { role: "me", text: myAnswer }]);
    setFollowAnswer("");
    followups.current.push({ question: lastQ, answer: myAnswer });
    try {
      const r = await data.followUp({ case_id: caseView.id, turn_index: turn, previous_answer: myAnswer, history: followups.current.slice(0, -1) });
      setChat((c) => [...c, { role: "interviewer", text: r.assessment + (r.next_question ? `\n\n${r.next_question}` : "") }]);
      setTurn((t) => t + 1);
      if (r.is_final || !r.next_question) setFollowDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFollowBusy(false);
    }
  }

  async function submit() {
    if (!caseView) return;
    if (answer.trim().length < 20) {
      setError("اكتب إجابة لا تقل عن 20 حرفًا.");
      return;
    }
    setError(null);
    setPhase("evaluating");
    try {
      const r = await data.evaluate({
        case_id: caseView.id,
        answer_text: answer.trim(),
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
        data_requests: revealed.map((x) => x.key),
        followup_answers: followups.current,
      });
      setResult(r);
      setPhase("result");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
      setPhase("case");
    }
  }

  const limitSeconds = challenge ? challenge : timed && caseView ? caseView.suggested_time_minutes * 60 : 0;
  const remaining = limitSeconds ? limitSeconds - seconds : 0;

  if (phase === "generating") return <Loading label={gen === null && aiConfigured ? "جارٍ توليد حالة أصلية والتحقق من عدم تكرارها… (قد يستغرق حتى دقيقة)" : "جارٍ تجهيز الحالة…"} />;
  if (phase === "evaluating") return <Loading label={aiConfigured ? "جارٍ تقييم إجابتك وفق Rubric من 100 درجة…" : "جارٍ التقييم المحلي…"} />;

  if (phase === "setup") {
    return (
      <>
        <div className="topbar">
          <div>
            <h1>محاكاة الحالة</h1>
            <p className="muted">اختر المواصفات، وستُولَّد حالة أصلية غير مكررة (أو تُعرض حالة ثابتة عند عدم ربط الذكاء الاصطناعي).</p>
          </div>
        </div>
        {aiConfigured === false && (
          <Alert tone="warn">
            {isDemo ? "الوضع التجريبي: ستُعرض حالات ثابتة من المكتبة المضمَّنة وتقييم محلي مبسّط." : "لم يُربط مزود الذكاء الاصطناعي بعد؛ ستُعرض حالات ثابتة من المكتبة وتقييم محلي حتمي. تواصل مع مسؤول النظام لتفعيل التوليد والتقييم الذكي."}
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <Card>
          <div className="grid grid-2">
            <Field label="المستوى" htmlFor="lvl" hint={role === "admin" ? "بصفتك مسؤولًا يمكنك اختيار أي مستوى" : "يمكنك اختيار مستواك أو الأعلى منه بدرجة واحدة كتحدٍ"}>
              <select id="lvl" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {LEVELS.filter((l) => LEVEL_ORDER[l] <= maxLevelIdx).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="القطاع" htmlFor="sec" hint="اتركه فارغًا لاختيار قطاعك المفضل أو الأقل تكرارًا">
              <select id="sec" value={sector} onChange={(e) => setSector(e.target.value as SectorKey | "")}>
                <option value="">تلقائي</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المهارة المستهدفة" htmlFor="skl" hint="اتركها فارغة لاختيار أضعف مهاراتك تلقائيًا">
              <select id="skl" value={skill} onChange={(e) => setSkill(e.target.value as SkillKey | "")}>
                <option value="">تلقائي (أضعف مهارة)</option>
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {SKILL_LABELS[s].ar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="نمط الحالة" htmlFor="ct">
              <select id="ct" value={caseType} onChange={(e) => setCaseType(e.target.value as CaseType)}>
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CASE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="btn-row">
            <label className="check-row" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> مؤقت وفق الوقت المقترح للحالة
            </label>
            <label className="check-row" style={{ marginBottom: 0 }}>
              <span>تحدي التوصية السريعة:</span>
              <select value={challenge} onChange={(e) => setChallenge(Number(e.target.value) as 0 | 60 | 90)} style={{ width: "auto" }} aria-label="تحدي زمني">
                <option value={0}>بلا</option>
                <option value={60}>60 ثانية</option>
                <option value={90}>90 ثانية</option>
              </select>
            </label>
          </div>
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <button className="btn btn-gold" onClick={() => void start()} type="button">
              توليد حالة جديدة
            </button>
            <Link to="/history" className="btn btn-outline">
              إعادة حالة سابقة من السجل
            </Link>
          </div>
        </Card>
      </>
    );
  }

  if (phase === "case" && caseView) {
    return (
      <>
        <div className="topbar">
          <div>
            <h1>{caseView.title}</h1>
            <div className="btn-row">
              <Badge tone="green">{LEVEL_LABELS[caseView.level]}</Badge>
              <Badge tone="blue">{SKILL_LABELS[caseView.skill].ar}</Badge>
              <Badge>{SECTOR_LABELS[caseView.sector]}</Badge>
              <Badge tone="gold">{CASE_TYPE_LABELS[caseView.case_type]}</Badge>
              {caseView.source !== "ai" && <Badge tone="amber">حالة ثابتة (غير مولدة)</Badge>}
            </div>
          </div>
          <div className="btn-row">
            <span className="muted small">الوقت المقترح: {caseView.suggested_time_minutes} د</span>
            <span className={`timer ${limitSeconds && remaining < 60 ? "warn" : ""}`} aria-live="off">
              {limitSeconds ? fmt(Math.max(0, remaining)) : fmt(seconds)}
            </span>
          </div>
        </div>
        {gen?.message && <Alert tone="info">{gen.message}</Alert>}
        {limitSeconds > 0 && remaining <= 0 && <Alert tone="warn">انتهى الوقت المحدد. يمكنك الإرسال الآن؛ سيُؤخذ الوقت في الاعتبار.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <div className="two-col">
          <div>
            <Card title="عرض الحالة تدريجيًا">
              <div className="reveal-step">
                <b>العميل:</b> {caseView.client}
                <p style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{caseView.context}</p>
              </div>
              {step >= 1 && (
                <div className="reveal-step">
                  <b>المشكلة الرئيسة:</b> {caseView.core_problem}
                  <p style={{ marginTop: "0.4rem" }}>
                    <b>القرار المطلوب:</b> {caseView.decision_required}
                  </p>
                </div>
              )}
              {step >= 2 && (
                <div className="reveal-step">
                  <b>الأهداف:</b>
                  <ul>
                    {caseView.objectives.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                  <b>القيود:</b>
                  <ul>
                    {caseView.constraints.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {step >= 3 && (
                <div className="reveal-step">
                  <b>البيانات المتاحة:</b>
                  <div className="data-list" style={{ marginTop: "0.5rem" }}>
                    {caseView.available_data.map((d, i) => (
                      <div className="data-item" key={i}>
                        <div className="lbl">{d.label}</div>
                        <div className="val">
                          {d.value} {d.unit ?? ""}
                        </div>
                        {d.note && <div className="small muted">{d.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {step < REVEAL_STEPS.length - 1 && (
                <button className="btn btn-outline" onClick={() => setStep((s) => s + 1)} type="button">
                  التالي: {REVEAL_STEPS[step + 1]}
                </button>
              )}
            </Card>

            {step >= 3 && caseView.hidden_data_labels.length > 0 && (
              <Card title="طلب بيانات إضافية" actions={<span className="muted small">اطلب فقط ما تحتاجه لاختبار فرضياتك</span>}>
                <div className="btn-row">
                  {caseView.hidden_data_labels.map((h) => {
                    const r = revealed.find((x) => x.key === h.key);
                    return (
                      <button key={h.key} className={`btn btn-sm ${r ? "btn-primary" : "btn-outline"}`} onClick={() => void reveal(h.key)} type="button" disabled={Boolean(r)}>
                        {h.label}
                      </button>
                    );
                  })}
                </div>
                {revealed.length > 0 && (
                  <div className="data-list" style={{ marginTop: "0.75rem" }}>
                    {revealed.map((r) => (
                      <div className="data-item" key={r.key}>
                        <div className="lbl">{r.label}</div>
                        <div className="val">
                          {r.value} {r.unit ?? ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {caseView.case_type === "interviewer_led" && step >= 1 && (
              <Card title="حوار المحاور" actions={<Badge tone={aiConfigured ? "gold" : "gray"}>{aiConfigured ? "محاور ذكي" : "أسئلة ثابتة"}</Badge>}>
                <div className="chat" aria-live="polite">
                  {chat.map((c, i) => (
                    <div key={i} className={`bubble ${c.role}`} style={{ whiteSpace: "pre-wrap" }}>
                      {c.text}
                    </div>
                  ))}
                </div>
                {!followDone && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <label htmlFor="fu" className="sr-only">
                      إجابتك على المحاور
                    </label>
                    <textarea id="fu" value={followAnswer} onChange={(e) => setFollowAnswer(e.target.value)} style={{ minHeight: 90 }} placeholder="أجب عن سؤال المحاور بإيجاز…" />
                    <button className="btn btn-primary btn-sm" onClick={() => void sendFollowUp()} disabled={followBusy || !followAnswer.trim()} type="button">
                      {followBusy ? "…" : "إرسال الإجابة"}
                    </button>
                  </div>
                )}
                {followDone && <p className="muted small">انتهى الحوار. اكتب الآن توصيتك النهائية وأرسلها للتقييم.</p>}
              </Card>
            )}
          </div>
          <div className="sticky-side">
            <Card title={challenge ? `توصيتك خلال ${challenge} ثانية` : "إجابتك التحليلية"}>
              <p className="muted small">ابدأ بالتوصية، ثم الأسباب بالأرقام، ثم المفاضلة والمخاطر والخطوات التالية.</p>
              <label htmlFor="ans" className="sr-only">
                الإجابة
              </label>
              <textarea id="ans" value={answer} onChange={(e) => setAnswer(e.target.value)} style={{ minHeight: 320 }} placeholder="اكتب إجابتك هنا…" />
              <div className="btn-row" style={{ marginTop: "0.6rem" }}>
                <button className="btn btn-gold" onClick={() => void submit()} type="button" disabled={step < 3 && !challenge}>
                  إرسال للتقييم
                </button>
                <span className="muted small">{answer.trim().split(/\s+/).filter(Boolean).length} كلمة</span>
              </div>
              {step < 3 && !challenge && <p className="small muted">اكشف جميع أقسام الحالة قبل الإرسال.</p>}
            </Card>
          </div>
        </div>
      </>
    );
  }

  if (phase === "result" && result && caseView) {
    const ev = result.evaluation;
    const nx = ev.next_case_recommendation;
    return (
      <>
        <div className="topbar">
          <div>
            <h1>نتيجة التقييم</h1>
            <p className="muted">{caseView.title}</p>
          </div>
          <div className="btn-row">
            <Badge tone={ev.evaluation_type === "ai" ? "gold" : "amber"}>{ev.evaluation_type === "ai" ? "تقييم ذكاء اصطناعي" : "تقييم محلي مبسّط (ليس ذكاءً اصطناعيًا)"}</Badge>
            <Badge>{ev.prompt_version}</Badge>
          </div>
        </div>
        <div className="two-col">
          <div>
            <Card>
              <div className="grid grid-2">
                <div style={{ display: "grid", placeItems: "center", gap: "0.5rem" }}>
                  <ScoreStamp score={ev.total_score} label={PERFORMANCE_LABELS[ev.performance_level]} />
                  <div className="muted small">من 100 وفق Rubric بسبعة أبعاد</div>
                </div>
                <div>
                  <DimensionBars scores={ev.dimension_scores} />
                </div>
              </div>
            </Card>
            <div className="grid grid-2">
              <Card title="نقاط القوة">
                <ul>{ev.strengths.length ? ev.strengths.map((s, i) => <li key={i}>{s}</li>) : <li className="muted">—</li>}</ul>
              </Card>
              <Card title="الأخطاء">
                <ul>{ev.errors.length ? ev.errors.map((s, i) => <li key={i}>{s}</li>) : <li className="muted">—</li>}</ul>
              </Card>
              <Card title="الفجوات">
                <ul>{ev.gaps.length ? ev.gaps.map((s, i) => <li key={i}>{s}</li>) : <li className="muted">—</li>}</ul>
              </Card>
              <Card title="الافتراضات التي لم تذكرها">
                <ul>{ev.missing_assumptions.length ? ev.missing_assumptions.map((s, i) => <li key={i}>{s}</li>) : <li className="muted">—</li>}</ul>
              </Card>
            </div>
            <Card title="الحسابات">
              <b>صحيحة:</b>
              <ul>{ev.calculations.correct.length ? ev.calculations.correct.map((s, i) => <li key={i}>{s}</li>) : <li className="muted">لا شيء</li>}</ul>
              <b>خاطئة أو ناقصة:</b>
              <ul>
                {ev.calculations.incorrect.length ? (
                  ev.calculations.incorrect.map((s, i) => (
                    <li key={i}>
                      {s.claim} <span className="muted">← {s.correction}</span>
                    </li>
                  ))
                ) : (
                  <li className="muted">لا شيء</li>
                )}
              </ul>
            </Card>
            <div className="grid grid-2">
              <Card title="تطبيق MECE">
                <Badge tone={ev.mece_assessment.applied ? "green" : "red"}>{ev.mece_assessment.applied ? "مطبَّق" : "غير مطبَّق"}</Badge> <span>{ev.mece_assessment.comment}</span>
              </Card>
              <Card title="وضوح التوصية">
                <Badge tone={ev.recommendation_clarity.clear ? "green" : "red"}>{ev.recommendation_clarity.clear ? "واضحة" : "غير واضحة"}</Badge> <span>{ev.recommendation_clarity.comment}</span>
              </Card>
            </div>
            {ev.off_topic.length > 0 && (
              <Card title="جوانب خرجت عن السؤال">
                <ul>
                  {ev.off_topic.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title="صياغة محسّنة لإجابتك">
              <p style={{ whiteSpace: "pre-wrap" }}>{ev.improved_answer}</p>
            </Card>
            <Card title="الإجابة المعيارية" actions={<button className="btn btn-sm btn-outline" onClick={() => setShowModel((s) => !s)} type="button">{showModel ? "إخفاء" : "عرض"}</button>}>
              {showModel ? <p style={{ whiteSpace: "pre-wrap" }}>{ev.model_answer}</p> : <p className="muted small">اعرضها بعد مراجعة ملاحظاتك.</p>}
            </Card>
          </div>
          <div className="sticky-side">
            <Card title="تمرين لمعالجة أضعف مهارة">
              <Badge tone="blue">{SKILL_LABELS[ev.targeted_exercise.skill].ar}</Badge>
              <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{ev.targeted_exercise.exercise}</p>
            </Card>
            <Card title="الحالة التالية الموصى بها">
              <p>{nx.reason}</p>
              <div className="btn-row" style={{ marginBottom: "0.6rem" }}>
                <Badge tone="blue">{SKILL_LABELS[nx.skill].ar}</Badge>
                <Badge>{LEVEL_LABELS[nx.level]}</Badge>
                <Badge>{SECTOR_LABELS[nx.sector]}</Badge>
              </div>
              <button
                className="btn btn-gold"
                type="button"
                onClick={() => {
                  setSkill(nx.skill);
                  setLevel(LEVEL_ORDER[nx.level] <= maxLevelIdx ? nx.level : level);
                  setSector(nx.sector);
                  setPhase("setup");
                  window.scrollTo({ top: 0 });
                }}
              >
                ابدأ الحالة التالية
              </button>
            </Card>
            <Card title="إجابتك">
              <p style={{ whiteSpace: "pre-wrap" }} className="small">
                {answer}
              </p>
            </Card>
            <Link to="/history" className="btn btn-outline">
              سجل الممارسة
            </Link>
          </div>
        </div>
      </>
    );
  }
  return null;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
