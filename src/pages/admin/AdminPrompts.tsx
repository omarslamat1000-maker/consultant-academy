import { useEffect, useState } from "react";
import { Alert, Badge, Card, Field, Loading, formatDate } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";

export function AdminPrompts() {
  const [builtin, setBuiltin] = useState<{ key: string; version: string; content: string }[]>([]);
  const [custom, setCustom] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<{ key: string; version: string; content: string; notes: string } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi.prompts.list();
      setBuiltin(r.builtin);
      setCustom(r.custom);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  return (
    <>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Alert tone="info">القوالب المضمَّنة في الكود هي المرجع الافتراضي. عند تفعيل إصدار مخصص لقالب ما، يستخدمه الخادم بدلًا من المضمَّن مع تسجيل رقم الإصدار في كل حالة وتقييم (Prompt Versioning).</Alert>
      <Card title="القوالب المضمَّنة (للقراءة)">
        {builtin.map((b) => (
          <div className="list-item" key={b.key}>
            <div>
              <b dir="ltr" style={{ display: "inline-block" }}>
                {b.key}
              </b>{" "}
              <Badge>{b.version}</Badge>
            </div>
            <div className="btn-row">
              <button className="btn btn-sm btn-outline" onClick={() => setViewing(viewing === b.key ? null : b.key)} type="button">
                {viewing === b.key ? "إخفاء" : "عرض"}
              </button>
              <button className="btn btn-sm btn-gold" onClick={() => setForm({ key: b.key, version: `${b.version}-custom-1`, content: b.content, notes: "" })} type="button">
                إنشاء إصدار مخصص منه
              </button>
            </div>
            {viewing === b.key && <pre style={{ whiteSpace: "pre-wrap", direction: "rtl", textAlign: "right", width: "100%" }}>{b.content}</pre>}
          </div>
        ))}
      </Card>
      <Card title="الإصدارات المخصصة">
        {custom.length === 0 && <p className="muted">لا توجد إصدارات مخصصة.</p>}
        {custom.map((c) => (
          <div className="list-item" key={c.id}>
            <div>
              <b dir="ltr" style={{ display: "inline-block" }}>
                {c.key}
              </b>{" "}
              <Badge tone={c.is_active ? "green" : "gray"}>{c.version}</Badge> {c.is_active && <Badge tone="gold">نشط</Badge>}
              <div className="small muted">
                {c.notes} · {formatDate(c.created_at)}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-sm btn-outline" onClick={() => setForm({ key: c.key, version: `${c.version}-next`, content: c.content, notes: "" })} type="button">
                نسخ
              </button>
              {c.is_active ? (
                <button className="btn btn-sm btn-danger" onClick={() => void act(() => adminApi.prompts.deactivate(c.id), "أُلغي تفعيل الإصدار (يُستخدم المضمَّن).")} type="button">
                  إلغاء التفعيل
                </button>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={() => void act(() => adminApi.prompts.activate(c.id), "تم تفعيل الإصدار.")} type="button">
                  تفعيل
                </button>
              )}
            </div>
          </div>
        ))}
      </Card>
      {form && (
        <Card title="إصدار مخصص جديد">
          <div className="grid grid-2">
            <Field label="القالب" htmlFor="pk">
              <input id="pk" value={form.key} readOnly dir="ltr" />
            </Field>
            <Field label="رقم الإصدار" htmlFor="pv">
              <input id="pv" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} dir="ltr" />
            </Field>
          </div>
          <Field label="ملاحظات" htmlFor="pn">
            <input id="pn" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Field label="المحتوى" htmlFor="pc" hint="حافظ على المتغيرات {{...}} كما هي">
            <textarea id="pc" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} style={{ minHeight: 360 }} />
          </Field>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => void act(() => adminApi.prompts.create(form.key, form.version, form.content, form.notes).then(() => setForm(null)), "تم إنشاء الإصدار (غير مفعّل).")} type="button">
              حفظ الإصدار
            </button>
            <button className="btn btn-ghost" onClick={() => setForm(null)} type="button">
              إلغاء
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
