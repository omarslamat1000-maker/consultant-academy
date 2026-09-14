import { useEffect, useState } from "react";
import { LEVELS, LEVEL_LABELS, QUESTION_TYPES, QUESTION_TYPE_LABELS, SKILLS, SKILL_LABELS, type Level, type QuestionType, type QuizQuestion, type SkillKey } from "../../../shared/types.ts";
import { Alert, Badge, Card, Field, Loading } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";

export function AdminQuestions() {
  const [modules, setModules] = useState<any[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [optionsText, setOptionsText] = useState("[]");
  const [answerText, setAnswerText] = useState("{}");

  useEffect(() => {
    adminApi.modules
      .list()
      .then((m) => {
        setModules(m);
        if (m[0]) setModuleId(m[0].id);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!moduleId) return;
    setLoading(true);
    adminApi.questions
      .list(moduleId)
      .then(setQuestions)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [moduleId]);

  function startEdit(q: Partial<QuizQuestion> & { is_published?: boolean }) {
    setEditing({ ...q });
    setOptionsText(JSON.stringify(q.options ?? [], null, 2));
    setAnswerText(JSON.stringify(q.correct_answer ?? {}, null, 2));
    setMsg(null);
  }
  function startNew() {
    const mod = modules.find((m) => m.id === moduleId);
    startEdit({ module_id: moduleId, skill: mod?.content?.primary_skill ?? "problem_definition", level: mod?.level ?? "beginner", question_type: "mcq", question: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }], correct_answer: { option: "a" }, explanation: "", is_published: true });
  }

  async function save() {
    let options: unknown;
    let correct: unknown;
    try {
      options = JSON.parse(optionsText);
      correct = JSON.parse(answerText);
    } catch {
      setError("الخيارات أو الإجابة الصحيحة ليست JSON صالحًا.");
      return;
    }
    if (!editing.question?.trim()) return setError("نص السؤال مطلوب.");
    setError(null);
    try {
      await adminApi.questions.save({ ...editing, options, correct_answer: correct });
      setMsg("تم حفظ السؤال.");
      setEditing(null);
      setQuestions(await adminApi.questions.list(moduleId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function remove(q: QuizQuestion) {
    if (!confirm("حذف هذا السؤال؟")) return;
    try {
      await adminApi.questions.remove(q.id);
      setQuestions(await adminApi.questions.list(moduleId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Card title="بنك الأسئلة الثابتة" actions={<button className="btn btn-sm btn-gold" onClick={startNew} type="button" disabled={!moduleId}>سؤال جديد</button>}>
        <Field label="الوحدة" htmlFor="m">
          <select id="m" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.order_index}. {m.title}
              </option>
            ))}
          </select>
        </Field>
        {loading ? (
          <Loading />
        ) : (
          questions.map((q, i) => (
            <div className="list-item" key={q.id}>
              <div>
                <b>
                  {i + 1}. {q.question.slice(0, 120)}
                  {q.question.length > 120 ? "…" : ""}
                </b>
                <div className="small muted">
                  <Badge>{QUESTION_TYPE_LABELS[q.question_type]}</Badge> {SKILL_LABELS[q.skill]?.ar} · {LEVEL_LABELS[q.level]}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-sm btn-outline" onClick={() => startEdit(q)} type="button">
                  تعديل
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => void remove(q)} type="button">
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
      {editing && (
        <Card title={editing.id ? "تعديل سؤال" : "سؤال جديد"}>
          <div className="grid grid-3">
            <Field label="النوع" htmlFor="qt">
              <select id="qt" value={editing.question_type} onChange={(e) => setEditing({ ...editing, question_type: e.target.value as QuestionType })}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المهارة" htmlFor="qs">
              <select id="qs" value={editing.skill} onChange={(e) => setEditing({ ...editing, skill: e.target.value as SkillKey })}>
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {SKILL_LABELS[s].ar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المستوى" htmlFor="ql">
              <select id="ql" value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value as Level })}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="نص السؤال" htmlFor="qq">
            <textarea id="qq" value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} style={{ minHeight: 90 }} />
          </Field>
          <div className="grid grid-2">
            <Field label="الخيارات (JSON)" htmlFor="qo" hint='مثال: [{"id":"a","text":"..."}] أو {"left":[...],"right":[...]} أو {"table":{...},"choices":[...]}'>
              <textarea id="qo" className="json-editor" style={{ minHeight: 180 }} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
            </Field>
            <Field label="الإجابة الصحيحة (JSON)" htmlFor="qa" hint='مثال: {"option":"a"} / {"value":true} / {"order":[...]} / {"pairs":{...}} / {"value":12,"tolerance":0.5} / {"keywords":[...],"min_matches":3}'>
              <textarea id="qa" className="json-editor" style={{ minHeight: 180 }} value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
            </Field>
          </div>
          <Field label="الشرح" htmlFor="qe">
            <textarea id="qe" value={editing.explanation ?? ""} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} style={{ minHeight: 70 }} />
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> منشور
          </label>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => void save()} type="button">
              حفظ
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} type="button">
              إلغاء
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
