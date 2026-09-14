import { useEffect, useState } from "react";
import { LEVELS, LEVEL_LABELS, type Level, type Role } from "../../../shared/types.ts";
import { Alert, Badge, Card, ErrorState, Loading, formatDate } from "../../components/ui.tsx";
import { errorMessage } from "../../lib/api.ts";
import { adminApi, type AdminUserRow } from "../../lib/admin-api.ts";

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi.listUsers(p);
      setUsers(r.users);
      setPage(r.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRole(u: AdminUserRow, role: Role) {
    try {
      await adminApi.setRole(u.id, role);
      setMsg(`تم تحديث دور ${u.email}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function setLevel(u: AdminUserRow, level: Level) {
    try {
      await adminApi.setLevel(u.id, level);
      setMsg(`تم تحديث مستوى ${u.email}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Loading />;
  if (error && users.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;
  return (
    <Card title="إدارة المستخدمين" actions={<span className="muted small">الصفحة {page}</span>}>
      {msg && <Alert tone="success">{msg}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>البريد</th>
              <th>الاسم</th>
              <th>الدور</th>
              <th>المستوى</th>
              <th>المحاولات</th>
              <th>المتوسط</th>
              <th>آخر دخول</th>
              <th>مؤكد</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td dir="ltr" style={{ textAlign: "right" }}>
                  {u.email}
                </td>
                <td>{u.display_name || "—"}</td>
                <td>
                  <select value={u.role} onChange={(e) => void setRole(u, e.target.value as Role)} aria-label={`دور ${u.email}`}>
                    <option value="learner">متدرب</option>
                    <option value="admin">مسؤول</option>
                  </select>
                </td>
                <td>
                  <select value={u.level} onChange={(e) => void setLevel(u, e.target.value as Level)} aria-label={`مستوى ${u.email}`}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.attempts}</td>
                <td>{u.avg_score ?? "—"}</td>
                <td className="small">{formatDate(u.last_sign_in_at)}</td>
                <td>{u.confirmed ? <Badge tone="green">نعم</Badge> : <Badge tone="amber">لا</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="btn-row" style={{ marginTop: "0.75rem" }}>
        <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => void load(page - 1)} type="button">
          السابق
        </button>
        <button className="btn btn-sm btn-outline" disabled={users.length < 50} onClick={() => void load(page + 1)} type="button">
          التالي
        </button>
      </div>
    </Card>
  );
}
