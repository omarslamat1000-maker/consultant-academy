import { useEffect, useState, type FormEvent } from "react";
import { LEVEL_LABELS, SECTORS, SECTOR_LABELS, type SectorKey } from "../../shared/types.ts";
import { Alert, Card, Field } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { errorMessage } from "../lib/api.ts";
import { data } from "../lib/data.ts";
import { resetDemo } from "../lib/demo-store.ts";

export function ProfilePage() {
  const { profile, refreshProfile, isDemo, updatePassword, user, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [sector, setSector] = useState<SectorKey | "">(profile?.preferred_sector ?? "");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? "");
    setSector(profile?.preferred_sector ?? "");
  }, [profile]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await data.updateProfile({ display_name: name.trim(), preferred_sector: sector || null });
      await refreshProfile();
      setMsg({ tone: "success", text: "تم حفظ الملف الشخصي." });
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ tone: "error", text: "كلمة المرور يجب ألا تقل عن 8 أحرف." });
    setBusy(true);
    try {
      await updatePassword(pw);
      setPw("");
      setMsg({ tone: "success", text: "تم تحديث كلمة المرور." });
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>الملف الشخصي</h1>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title="البيانات الأساسية">
        <form onSubmit={save}>
          <dl className="kv" style={{ marginBottom: "1rem" }}>
            <dt>البريد</dt>
            <dd dir="ltr" style={{ textAlign: "right" }}>
              {user?.email ?? "—"}
            </dd>
            <dt>المستوى</dt>
            <dd>{LEVEL_LABELS[profile?.level ?? "beginner"]} (يتغير وفق قواعد الانتقال، لا يدويًا)</dd>
          </dl>
          <Field label="الاسم المعروض" htmlFor="dn">
            <input id="dn" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} />
          </Field>
          <Field label="القطاع المفضل" htmlFor="ps" hint="يُستخدم افتراضيًا عند توليد الحالات">
            <select id="ps" value={sector} onChange={(e) => setSector(e.target.value as SectorKey | "")}>
              <option value="">بلا تفضيل (تناوب تلقائي)</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy} type="submit">
              حفظ
            </button>
            <button className="btn btn-outline" type="button" onClick={() => void signOut()}>
              تسجيل الخروج
            </button>
          </div>
        </form>
      </Card>
      {!isDemo && (
        <Card title="تغيير كلمة المرور">
          <form onSubmit={changePw}>
            <Field label="كلمة المرور الجديدة" htmlFor="pw">
              <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" autoComplete="new-password" />
            </Field>
            <button className="btn btn-outline" disabled={busy} type="submit">
              تحديث كلمة المرور
            </button>
          </form>
        </Card>
      )}
      {isDemo && (
        <Card title="بيانات الوضع التجريبي">
          <p className="muted">البيانات محفوظة في هذا المتصفح فقط. يمكنك مسحها والبدء من جديد.</p>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              if (confirm("سيتم مسح جميع بيانات التجربة في هذا المتصفح. هل تريد المتابعة؟")) {
                resetDemo();
                void signOut();
              }
            }}
          >
            مسح بيانات التجربة
          </button>
        </Card>
      )}
    </>
  );
}
