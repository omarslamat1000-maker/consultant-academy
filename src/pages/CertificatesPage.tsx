import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { certificatesFromHistory, type CertificateInfo } from "../../shared/certificates.ts";
import { LEVELS, LEVEL_LABELS, type Level } from "../../shared/types.ts";
import { TreeMotif } from "../components/TreeMotif.tsx";
import { Badge, Card, EmptyState, ErrorState, Loading, formatDate } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { errorMessage } from "../lib/api.ts";
import { data } from "../lib/data.ts";

function useCertificates() {
  const { profile } = useAuth();
  const [certs, setCerts] = useState<CertificateInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setError(null);
    try {
      const history = await data.listLevelHistory();
      setCerts(certificatesFromHistory(profile?.id ?? "", history));
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
  return { certs, error, reload: load };
}

export function CertificatesPage() {
  const { certs, error, reload } = useCertificates();
  const { profile } = useAuth();
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!certs) return <Loading label="جارٍ تحميل الشهادات…" />;
  const current = profile?.level ?? "beginner";
  return (
    <>
      <div className="topbar">
        <div>
          <h1>شهادات إتمام المستوى</h1>
          <p className="muted">تُمنح الشهادة عند الانتقال إلى المستوى التالي وفق قواعد الانتقال (وحدات المستوى، 3 اختبارات و3 حالات غير مكررة بنسبة 70%، وحد أدنى للمهارات الرئيسة).</p>
        </div>
      </div>
      {certs.length === 0 ? (
        <EmptyState
          title="لا توجد شهادات بعد"
          hint={`أنت في مستوى ${LEVEL_LABELS[current]}. عند تحقيق شروط الانتقال تُصدر شهادة إتمام هذا المستوى تلقائيًا.`}
          action={
            <Link to="/" className="btn btn-primary">
              شروط الانتقال في لوحة التقدم
            </Link>
          }
        />
      ) : (
        <Card>
          {certs.map((c) => (
            <div key={c.level} className="list-item">
              <div>
                <b>شهادة إتمام مستوى {c.completed_label}</b>
                <div className="small muted">
                  الانتقال إلى {c.label} في {formatDate(c.achieved_at)} · رمز التحقق <code>{c.code}</code>
                </div>
              </div>
              <div className="btn-row">
                <Badge tone="gold">{c.completed_label}</Badge>
                <Link to={`/certificate/${c.level}`} className="btn btn-sm btn-primary">
                  عرض وطباعة
                </Link>
              </div>
            </div>
          ))}
        </Card>
      )}
      <p className="small muted" style={{ marginTop: "0.75rem" }}>
        المستويات: {LEVELS.map((l) => LEVEL_LABELS[l]).join(" ← ")}.
      </p>
    </>
  );
}

export function CertificatePage() {
  const { level } = useParams();
  const { certs, error, reload } = useCertificates();
  const { profile, user } = useAuth();
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!certs) return <Loading label="جارٍ تحميل الشهادة…" />;
  const cert = certs.find((c) => c.level === (level as Level));
  if (!cert) {
    return <EmptyState title="الشهادة غير متاحة" hint="لم يُسجَّل بعد الانتقال إلى هذا المستوى." action={<Link to="/certificates" className="btn btn-primary">كل الشهادات</Link>} />;
  }
  const name = profile?.display_name?.trim() || user?.email || "المتدرب";
  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1>شهادة إتمام مستوى {cert.completed_label}</h1>
          <p className="muted">اطبعها أو احفظها كملف PDF من نافذة الطباعة.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-gold" type="button" onClick={() => window.print()}>
            طباعة / حفظ PDF
          </button>
          <Link to="/certificates" className="btn btn-outline">
            رجوع
          </Link>
        </div>
      </div>
      <article className="certificate" aria-label="شهادة إتمام المستوى">
        <TreeMotif size={360} animated={false} className="tree-bg" />
        <p className="cert-eyebrow">أكاديمية المستشار</p>
        <h2>شهادة إتمام مستوى</h2>
        <p className="muted">تشهد أكاديمية المستشار بأن</p>
        <div className="cert-name">{name}</div>
        <p className="muted" style={{ margin: 0 }}>
          أتمّ بنجاح متطلبات مستوى
        </p>
        <div className="cert-level">{cert.completed_label}</div>
        <p style={{ maxWidth: 620, margin: "0 auto" }}>
          بإكمال وحدات المستوى، واجتياز ثلاثة اختبارات وثلاث حالات تطبيقية غير مكررة بنسبة 70% فأكثر، وتحقيق الحد الأدنى في المهارات الرئيسة، وانتقل إلى مستوى <b>{cert.label}</b>.
        </p>
        <div style={{ display: "grid", placeItems: "center", margin: "1rem 0 0" }}>
          <TreeMotif size={72} animated={false} stroke="#b8963e" />
        </div>
        <div className="cert-meta">
          <span>تاريخ الإنجاز: {formatDate(cert.achieved_at)}</span>
          <span>
            رمز التحقق: <bdi dir="ltr">{cert.code}</bdi>
          </span>
        </div>
      </article>
    </>
  );
}
