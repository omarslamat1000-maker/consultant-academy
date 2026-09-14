import { useEffect, useState } from "react";
import { Card, ErrorState, Loading, formatDate } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi } from "../../lib/admin-api.ts";

export function AdminAudit() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setError(null);
    try {
      setRows(await adminApi.audit());
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!rows) return <Loading />;
  const filtered = rows.filter((r) => !q || r.action.includes(q) || r.entity_type.includes(q) || (r.actor_id ?? "").includes(q));
  return (
    <Card title="سجل العمليات (آخر 200)" actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="تصفية بالإجراء أو النوع" aria-label="تصفية" style={{ width: 240 }} />}>
      <p className="muted small">لا يُسجَّل أي سر في هذا السجل؛ الحقول الحساسة تُحذف قبل التخزين.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الوقت</th>
              <th>الإجراء</th>
              <th>الكيان</th>
              <th>المنفذ</th>
              <th>بيانات آمنة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="small">{formatDate(r.created_at)}</td>
                <td dir="ltr" style={{ textAlign: "right" }}>
                  {r.action}
                </td>
                <td dir="ltr" style={{ textAlign: "right" }}>
                  {r.entity_type} {r.entity_id ? `#${String(r.entity_id).slice(0, 8)}` : ""}
                </td>
                <td className="small" dir="ltr" style={{ textAlign: "right" }}>
                  {r.actor_id ? String(r.actor_id).slice(0, 8) : "system"}
                </td>
                <td className="small" dir="ltr" style={{ textAlign: "left" }}>
                  {JSON.stringify(r.safe_metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
