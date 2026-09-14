import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TreeMotif } from "../components/TreeMotif.tsx";
import { Alert, Field } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { APP_NAME } from "../lib/config.ts";

type Mode = "login" | "signup" | "reset";

function Hero() {
  return (
    <aside className="login-hero" aria-label="عن المنصة">
      <TreeMotif size={520} className="tree-bg" />
      <div>
        <div className="brand" style={{ border: "none", padding: 0 }}>
          <div className="brand-mark" aria-hidden="true">
            <TreeMotif size={30} animated={false} />
          </div>
          <div>
            <p className="brand-title">{APP_NAME}</p>
            <p className="brand-sub">تدريب استشاري تكيفي للقطاع الحكومي والبنية التحتية</p>
          </div>
        </div>
        <h1>من الشكوى العامة إلى توصية تدافع عنها أمام نائب الأمين</h1>
        <p className="thesis">حالات أصلية بأرقام حقيقية، تقييم من 100 درجة على سبعة أبعاد، ومسار يصعد بك من صياغة سؤال القرار إلى الدفاع عن التوصية تحت ضغط الأسئلة.</p>
      </div>
      <div className="proof">
        <div>
          <b>12</b>
          <span>وحدة عبر أربعة مستويات</span>
        </div>
        <div>
          <b>7</b>
          <span>أبعاد تقييم بأوزان ثابتة</span>
        </div>
        <div>
          <b>0</b>
          <span>حالة مكررة — بصمة لكل حالة</span>
        </div>
      </div>
    </aside>
  );
}

export function LoginPage() {
  const { signIn, signUp, resetPassword, isDemo, demoSignIn } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    if (mode !== "reset" && password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setError("أدخل اسمك الكامل.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await signIn(email, password);
      else if (mode === "signup") {
        const r = await signUp(email, password, name.trim());
        if (r.needsConfirmation) {
          setNotice("أُنشئ الحساب. أرسلنا رسالة تأكيد إلى بريدك؛ افتح الرابط ثم سجّل الدخول.");
          setMode("login");
        }
      } else {
        await resetPassword(email);
        setNotice("إن كان البريد مسجلًا فستصلك رسالة لإعادة تعيين كلمة المرور.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إتمام العملية.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <Hero />
      <div className="login-panel">
        <div className="login-card">
          {isDemo ? (
            <>
              <p className="eyebrow">وضع تجريبي</p>
              <h2>جرّب المنصة بلا حساب</h2>
              <p className="muted">لم يُربط Supabase بعد. تُحفظ بياناتك في هذا المتصفح فقط، والتقييم محلي مبسّط وليس ذكاءً اصطناعيًا.</p>
              <button className="btn btn-gold" onClick={demoSignIn} type="button" style={{ width: "100%", justifyContent: "center" }}>
                دخول تجريبي
              </button>
              <p className="small muted" style={{ marginTop: "0.75rem" }}>
                لتفعيل الحسابات الحقيقية اتبع دليل إعداد Supabase في مجلد docs.
              </p>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <p className="eyebrow">{mode === "login" ? "الدخول إلى حسابك" : mode === "signup" ? "حساب جديد" : "استعادة الوصول"}</p>
              <h2>{mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب" : "استعادة كلمة المرور"}</h2>
              {error && <Alert tone="error">{error}</Alert>}
              {notice && <Alert tone="success">{notice}</Alert>}
              {mode === "signup" && (
                <Field label="الاسم الكامل" htmlFor="name">
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </Field>
              )}
              <Field label="البريد الإلكتروني" htmlFor="email">
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" required />
              </Field>
              {mode !== "reset" && (
                <Field label="كلمة المرور" htmlFor="password" hint={mode === "signup" ? "8 أحرف على الأقل" : undefined}>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} dir="ltr" required />
                </Field>
              )}
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
                {busy ? "جارٍ التنفيذ…" : mode === "login" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال رابط الاستعادة"}
              </button>
              <div className="divider" />
              <div className="btn-row" style={{ justifyContent: "center" }}>
                {mode !== "login" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("login")}>
                    لديك حساب؟ سجّل الدخول
                  </button>
                )}
                {mode !== "signup" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("signup")}>
                    إنشاء حساب جديد
                  </button>
                )}
                {mode !== "reset" && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("reset")}>
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين.");
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث كلمة المرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <Hero />
      <div className="login-panel">
        <div className="login-card">
          <h2>تعيين كلمة مرور جديدة</h2>
          {!user && <Alert tone="warn">افتح هذه الصفحة من رابط الاستعادة المرسل إلى بريدك.</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          {done && <Alert tone="success">تم تحديث كلمة المرور. جارٍ التحويل…</Alert>}
          <form onSubmit={submit} noValidate>
            <Field label="كلمة المرور الجديدة" htmlFor="np">
              <input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="new-password" />
            </Field>
            <Field label="تأكيد كلمة المرور" htmlFor="cp">
              <input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" autoComplete="new-password" />
            </Field>
            <button className="btn btn-primary" disabled={busy || !user} type="submit">
              حفظ كلمة المرور
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
