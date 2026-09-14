import { useEffect, useState } from "react";
import { LEVELS, LEVEL_LABELS, SKILLS, SKILL_LABELS, type Level } from "../../../shared/types.ts";
import { Alert, Badge, Card, ErrorState, Field, Loading } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";

const REQUIRED_KEYS = ["learning_objective", "explanation", "terms", "method_steps", "example_simple", "example_medium", "example_advanced", "common_mistakes", "checklist", "exercise", "applied_case", "result_interpretation", "next_recommendation", "completion_rule", "primary_skill"];

export function AdminModules() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [contentText, setContentText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setList(await adminApi.modules.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function startEdit(m: any) {
    setEditing({ ...m });
    setContentText(JSON.stringify(m.content ?? {}, null, 2));
    setMsg(null);
  }
  function startNew() {
    const content = { primary_skill: "problem_definition", learning_objective: "", explanation: [], terms: [], method_steps: [], example_simple: { title: "", situation: "", application: "", result: "" }, example_medium: { title: "", situation: "", application: "", result: "" }, example_advanced: { title: "", situation: "", application: "", result: "" }, common_mistakes: [], checklist: [], exercise: { prompt: "", guidance: [] }, applied_case: { title: "", scenario: "", data: [], task: "", model_answer: "" }, result_interpretation: [], next_recommendation: "", completion_rule: { quiz_min_score: 70, applied_case_min_score: 60, description: "" } };
    setEditing({ slug: "", title: "", description: "", level: "beginner", order_index: list.length + 1, is_published: false, content });
    setContentText(JSON.stringify(content, null, 2));
  }

  async function save() {
    if (!editing) return;
    let content: any;
    try {
      content = JSON.parse(contentText);
    } catch {
      setError("محتوى JSON غير صالح.");
      return;
    }
    const missing = REQUIRED_KEYS.filter((k) => !(k in content));
    if (missing.length) {
      setError(`حقول ناقصة في المحتوى: ${missing.join(", ")}`);
      return;
    }
    if (!SKILLS.includes(content.primary_skill)) {
      setError("primary_skill غير صالح.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.modules.save({ id: editing.id, slug: editing.slug, title: editing.title, description: editing.description, level: editing.level, order_index: Number(editing.order_index), content, is_published: editing.is_published });
      setMsg("تم حفظ الوحدة.");
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: any) {
    if (!confirm(`حذف الوحدة «${m.title}» وجميع أسئلتها وتقدم المتدربين فيها؟`)) return;
    try {
      await adminApi.modules.remove(m.id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (error && list.length === 0 && !editing) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {editing ? (
        <Card title={editing.id ? "تعديل وحدة" : "وحدة جديدة"}>
          <div className="grid grid-2">
            <Field label="العنوان" htmlFor="t">
              <input id="t" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="المعرّف (slug)" htmlFor="s">
              <input id="s" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} dir="ltr" />
            </Field>
            <Field label="المستوى" htmlFor="l">
              <select id="l" value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value as Level })}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الترتيب" htmlFor="o">
              <input id="o" type="number" value={editing.order_index} onChange={(e) => setEditing({ ...editing, order_index: e.target.value })} />
            </Field>
          </div>
          <Field label="الوصف" htmlFor="d">
            <textarea id="d" style={{ minHeight: 70 }} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> منشورة للمتدربين
          </label>
          <Field label="محتوى الوحدة (JSON)" htmlFor="c" hint={`الحقول المطلوبة: ${REQUIRED_KEYS.join(", ")}`}>
            <textarea id="c" className="json-editor" value={contentText} onChange={(e) => setContentText(e.target.value)} />
          </Field>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy} type="button">
              حفظ
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} type="button">
              إلغاء
            </button>
          </div>
        </Card>
      ) : (
        <Card title="إدارة الوحدات" actions={<button className="btn btn-sm btn-gold" onClick={startNew} type="button">وحدة جديدة</button>}>
          {list.map((m) => (
            <div className="list-item" key={m.id}>
              <div>
                <b>
                  {m.order_index}. {m.title}
                </b>{" "}
                <Badge tone="green">{LEVEL_LABELS[m.level as Level]}</Badge> <Badge tone="blue">{SKILL_LABELS[(m.content?.primary_skill ?? "problem_definition") as keyof typeof SKILL_LABELS]?.ar}</Badge>{" "}
                {m.is_published ? <Badge tone="gold">منشورة</Badge> : <Badge>مسودة</Badge>}
                <div className="small muted">{m.description}</div>
              </div>
              <div className="btn-row">
                <button className="btn btn-sm btn-outline" onClick={() => startEdit(m)} type="button">
                  تعديل
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => void remove(m)} type="button">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
