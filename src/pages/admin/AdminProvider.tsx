import { useEffect, useState, type FormEvent } from "react";
import { Alert, Badge, Card, Field, Loading, formatDate } from "../../components/ui.tsx";
import { ApiClientError, errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";
import { NETLIFY_SITE_NAME, SUPABASE_PROJECT_REF } from "../../lib/config.ts";

const MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

interface Health {
  ok: boolean;
  supabase: boolean;
  ai: boolean;
  encryption_ready?: boolean;
}

export function AdminProvider() {
  const [status, setStatus] = useState<any | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(MODELS[0]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [rotateFor, setRotateFor] = useState<string | null>(null);
  const [rotateKey, setRotateKey] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    setHealthError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth((await res.json()) as Health);
    } catch {
      setHealth(null);
      setHealthError("تعذر الوصول إلى الوظائف الخادمية (/api/health). تأكد من نشر Netlify Functions أو تشغيل npm run dev:api محليًا.");
    }
    try {
      setStatus(await adminApi.provider.status());
    } catch (err) {
      setStatus(null);
      setError(err instanceof ApiClientError && err.code === "server_error" ? "الوظائف الخادمية لا تستطيع الاتصال بقاعدة البيانات. اضبط SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY في متغيرات بيئة Netlify (أو ملف .env محليًا) ثم أعد التحميل." : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(label: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(label);
    setError(null);
    setMsg(null);
    try {
      const r = await fn();
      if (ok) setMsg(ok);
      await load();
      return r;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
    return undefined;
  }

  function keyLooksValid(k: string): boolean {
    return k.trim().length >= 30 && !/\s/.test(k.trim());
  }

  async function testTyped() {
    setTestResult(null);
    if (apiKey && !keyLooksValid(apiKey)) return setError("صيغة المفتاح غير صحيحة: يجب ألا يقل عن 30 حرفًا وبلا مسافات.");
    const r = await run("test", () => adminApi.provider.test({ provider: "gemini", api_key: apiKey.trim() || undefined, model }));
    if (r) setTestResult(r);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!keyLooksValid(apiKey)) return setError("أدخل مفتاح API صالحًا (30 حرفًا على الأقل وبلا مسافات).");
    await run("save", () => adminApi.provider.save({ provider: "gemini", api_key: apiKey.trim(), model, temperature, max_output_tokens: maxTokens }), "تم حفظ المفتاح مشفّرًا وتفعيل المزود. لن يُعرض المفتاح مرة أخرى.");
    setApiKey("");
    setTestResult(null);
  }

  if (loading) return <Loading label="جارٍ فحص جاهزية الربط…" />;

  const providers: any[] = status?.providers ?? [];
  const encryptionReady: boolean = status?.encryption_ready ?? health?.encryption_ready ?? false;
  const functionsUp = Boolean(health?.ok);
  const dbUp = Boolean(health?.supabase);
  const checklist: { label: string; ok: boolean; hint: string }[] = [
    { label: "الوظائف الخادمية متاحة (/api/health)", ok: functionsUp, hint: "انشر على Netlify أو شغّل npm run dev:api" },
    { label: "الوظائف متصلة بقاعدة البيانات (service_role)", ok: dbUp, hint: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY في Netlify" },
    { label: "مفتاح التشفير الرئيس مضبوط (CONFIG_ENCRYPTION_KEY)", ok: encryptionReady, hint: 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"' },
    { label: "مزود ذكاء اصطناعي نشط", ok: Boolean(status?.configured), hint: "أدخل المفتاح أدناه واضغط حفظ آمن، أو اضبط GEMINI_API_KEY" },
  ];
  const canSave = functionsUp && dbUp && encryptionReady;

  return (
    <>
      {msg && <Alert tone="success">{msg}</Alert>}
      {healthError && <Alert tone="error">{healthError}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <Card title="جاهزية الربط">
        <ul className="req-list" style={{ listStyle: "none", padding: 0 }}>
          {checklist.map((c) => (
            <li key={c.label} className={c.ok ? "met" : ""}>
              <span>
                {c.label}
                {!c.ok && (
                  <div className="small muted" dir="ltr" style={{ textAlign: "right" }}>
                    {c.hint}
                  </div>
                )}
              </span>
              <span className="st">{c.ok ? "✓" : "✗"}</span>
            </li>
          ))}
        </ul>
        {status?.configured && (
          <p className="small muted" style={{ marginTop: "0.5rem" }}>
            المصدر الحالي: {status.source === "db" ? "مفتاح محفوظ في التطبيق" : "متغير بيئة الخادم (GEMINI_API_KEY)"} · النموذج: {status.model}
          </p>
        )}
        <button className="btn btn-sm btn-outline" type="button" onClick={() => void load()} style={{ marginTop: "0.5rem" }}>
          إعادة الفحص
        </button>
      </Card>

      {functionsUp && !dbUp && (
        <Card title="الخطوة المطلوبة الآن: ربط الوظائف بقاعدة البيانات">
          <p>الوظائف الخادمية تعمل لكنها تحتاج مفتاح <b>service_role</b> السري من Supabase لتصحيح الاختبارات وتوليد الحالات وحفظ مفاتيح الذكاء. هذا المفتاح يُضاف مرة واحدة من لوحة الاستضافة ولا يُدخل أبدًا في هذه الصفحة.</p>
          <ol>
            <li>
              انسخ مفتاح <code>service_role</code> من{" "}
              {SUPABASE_PROJECT_REF ? (
                <a href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/settings/api-keys`} target="_blank" rel="noreferrer">
                  Supabase → Settings → API Keys
                </a>
              ) : (
                <span>Supabase → Settings → API Keys</span>
              )}
              .
            </li>
            <li>
              أضف متغيرًا باسم <code>SUPABASE_SERVICE_ROLE_KEY</code> في{" "}
              {NETLIFY_SITE_NAME ? (
                <a href={`https://app.netlify.com/projects/${NETLIFY_SITE_NAME}/configuration/env`} target="_blank" rel="noreferrer">
                  Netlify → Environment variables
                </a>
              ) : (
                <span>Netlify → Site configuration → Environment variables</span>
              )}{" "}
              (فعّل خيار Secret).
            </li>
            <li>
              أعد النشر من{" "}
              {NETLIFY_SITE_NAME ? (
                <a href={`https://app.netlify.com/projects/${NETLIFY_SITE_NAME}/deploys`} target="_blank" rel="noreferrer">
                  Netlify → Deploys → Trigger deploy
                </a>
              ) : (
                <span>Netlify → Deploys → Trigger deploy</span>
              )}
              ، ثم عد هنا واضغط «إعادة الفحص».
            </li>
          </ol>
        </Card>
      )}

      <Alert tone="warn">
        <b>تحذير:</b> لا تشارك مفتاح API مع أي أحد. يُرسل المفتاح مرة واحدة عبر HTTPS إلى الخادم، ويُشفَّر بـ AES-256-GCM قبل التخزين، ولا يُعاد إلى المتصفح أبدًا (تظهر آخر 4 أحرف فقط).
      </Alert>

      <Card title="إضافة مفتاح Google Gemini">
        <ol className="small muted" style={{ marginBottom: "0.75rem" }}>
          <li>
            أنشئ مفتاحًا من{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            .
          </li>
          <li>الصق المفتاح هنا واختر النموذج ثم اضغط «اختبار الاتصال».</li>
          <li>عند نجاح الاختبار اضغط «حفظ آمن» ليُفعَّل التوليد والتقييم الذكي فورًا.</li>
        </ol>
        <form onSubmit={save} autoComplete="off">
          <Field label="API Key" htmlFor="k" hint="لن يُحفظ في المتصفح ولن يظهر بعد الحفظ.">
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input id="k" type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} dir="ltr" autoComplete="off" spellCheck={false} placeholder="AIza…" />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowKey((s) => !s)} aria-pressed={showKey}>
                {showKey ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </Field>
          <div className="grid grid-3">
            <Field label="النموذج" htmlFor="m">
              <select id="m" value={model} onChange={(e) => setModel(e.target.value)}>
                {MODELS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="درجة الإبداع (Temperature)" htmlFor="t" hint="0 = ثابت، 1 = متنوع">
              <input id="t" type="number" step="0.1" min={0} max={2} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} dir="ltr" />
            </Field>
            <Field label="الحد الأقصى للمخرجات (tokens)" htmlFor="x">
              <input id="x" type="number" min={256} max={65536} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} dir="ltr" />
            </Field>
          </div>
          <div className="btn-row">
            <button className="btn btn-outline" type="button" onClick={() => void testTyped()} disabled={busy !== null || !functionsUp || !dbUp || (!apiKey && !status?.configured)}>
              {busy === "test" ? "جارٍ الاختبار…" : apiKey ? "اختبار الاتصال بالمفتاح المدخل" : "اختبار المفتاح المحفوظ"}
            </button>
            <button className="btn btn-primary" type="submit" disabled={busy !== null || !canSave || !apiKey}>
              {busy === "save" ? "جارٍ الحفظ…" : "حفظ آمن"}
            </button>
            {!canSave && <span className="small muted">أكمل بنود الجاهزية أعلاه لتفعيل الحفظ.</span>}
          </div>
          {testResult && (
            <Alert tone={testResult.ok ? "success" : "error"}>
              {testResult.message} ({testResult.model}، {testResult.latency_ms} ms)
            </Alert>
          )}
        </form>
      </Card>

      <Card title="المزودون المحفوظون">
        {providers.length === 0 && <p className="muted">لا يوجد مزود محفوظ بعد.</p>}
        {providers.map((p) => (
          <div key={p.id}>
            <div className="list-item">
              <div>
                <b>Google Gemini</b> <Badge tone={p.is_active ? "green" : "gray"}>{p.is_active ? "نشط" : "معطّل"}</Badge> <Badge>{p.model}</Badge>{" "}
                <Badge tone={p.last_test_ok === true ? "green" : p.last_test_ok === false ? "red" : "gray"}>{p.last_test_ok === true ? "آخر اختبار ناجح" : p.last_test_ok === false ? "آخر اختبار فاشل" : "لم يُختبر"}</Badge>
                <div className="small muted">
                  المفتاح: <span dir="ltr">{p.key_hint}</span> · أُضيف {formatDate(p.created_at)} بواسطة {p.created_by_name || "—"} · آخر اختبار {formatDate(p.last_tested_at)} · آخر تعديل بواسطة {p.updated_by_name || "—"}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-sm btn-outline" type="button" disabled={busy !== null} onClick={() => setRotateFor(rotateFor === p.id ? null : p.id)}>
                  تدوير المفتاح
                </button>
                {p.is_active ? (
                  <button className="btn btn-sm btn-outline" type="button" disabled={busy !== null} onClick={() => void run("toggle", () => adminApi.provider.setActive(p.id, false), "تم تعطيل المزود.")}>
                    تعطيل
                  </button>
                ) : (
                  <button className="btn btn-sm btn-primary" type="button" disabled={busy !== null} onClick={() => void run("toggle", () => adminApi.provider.setActive(p.id, true), "تم تفعيل المزود.")}>
                    تفعيل
                  </button>
                )}
                <button className="btn btn-sm btn-danger" type="button" disabled={busy !== null} onClick={() => confirm("حذف هذا المزود نهائيًا؟") && void run("delete", () => adminApi.provider.remove(p.id), "تم حذف المزود.")}>
                  حذف
                </button>
              </div>
            </div>
            {rotateFor === p.id && (
              <div style={{ padding: "0.5rem 0 1rem" }}>
                <Field label="المفتاح الجديد" htmlFor={`rk-${p.id}`}>
                  <input id={`rk-${p.id}`} type="password" value={rotateKey} onChange={(e) => setRotateKey(e.target.value)} dir="ltr" autoComplete="off" />
                </Field>
                <button
                  className="btn btn-sm btn-primary"
                  type="button"
                  disabled={busy !== null || !keyLooksValid(rotateKey)}
                  onClick={() =>
                    void run("rotate", () => adminApi.provider.rotate(p.id, rotateKey.trim()), "تم تدوير المفتاح.").then(() => {
                      setRotateKey("");
                      setRotateFor(null);
                    })
                  }
                >
                  تأكيد التدوير
                </button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
