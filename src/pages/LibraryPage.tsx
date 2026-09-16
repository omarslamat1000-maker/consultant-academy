import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CASE_LIBRARY_SIZE, summarizeLibrary, type LibraryCaseSummary } from "../../shared/cases/index.ts";
import { CASE_TYPE_LABELS, LEVELS, LEVEL_LABELS, LEVEL_ORDER, SECTORS, SECTOR_LABELS, SKILLS, SKILL_LABELS, type Level, type SectorKey, type SkillKey } from "../../shared/types.ts";
import { Badge, Card, EmptyState, Stat } from "../components/ui.tsx";
import { useAuth } from "../context/AuthContext.tsx";

const ALL = summarizeLibrary();

const LEVEL_TONE: Record<Level, "green" | "blue" | "gold" | "red"> = {
  beginner: "green",
  intermediate: "blue",
  expert: "gold",
  advanced_expert: "red",
};

export function LibraryPage() {
  const { profile, role } = useAuth();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Level | "">("");
  const [sector, setSector] = useState<SectorKey | "">("");
  const [skill, setSkill] = useState<SkillKey | "">("");
  const [onlyMine, setOnlyMine] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const userLevel = profile?.level ?? "beginner";
  const maxIdx = role === "admin" ? LEVELS.length - 1 : Math.min(LEVELS.length - 1, LEVEL_ORDER[userLevel] + 1);
  const canStart = (c: LibraryCaseSummary) => LEVEL_ORDER[c.level] <= maxIdx;

  const filtered = useMemo(
    () =>
      ALL.filter(
        (c) =>
          (!level || c.level === level) &&
          (!sector || c.sector === sector) &&
          (!skill || c.skill === skill) &&
          (!onlyMine || canStart(c)) &&
          (!q || c.title.includes(q) || c.core_problem.includes(q) || c.client.includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, sector, skill, onlyMine, q, maxIdx],
  );

  const counts = useMemo(() => {
    const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
    for (const c of ALL) byLevel[c.level]++;
    return byLevel;
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>مكتبة الحالات</h1>
          <p className="muted">
            {CASE_LIBRARY_SIZE} حالة مكتوبة يدويًا ومخزنة داخل المنصة، موزعة على 17 قطاعًا و4 مستويات. ابدأ أي حالة مباشرة؛ تُحتسب في سجلك وإتقانك مثل الحالات المولدة.
          </p>
        </div>
        <Link to="/simulator" className="btn btn-outline">
          توليد حالة جديدة
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: "1rem" }}>
        {LEVELS.map((l) => (
          <Stat key={l} label={LEVEL_LABELS[l]} value={counts[l]} hint={LEVEL_ORDER[l] <= maxIdx ? "متاح لك" : "يفتح عند الترقية"} />
        ))}
      </div>

      <div className="filters">
        <div className="field">
          <label htmlFor="lq">بحث</label>
          <input id="lq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="عنوان الحالة أو المشكلة أو العميل" />
        </div>
        <div className="field">
          <label htmlFor="ll">المستوى</label>
          <select id="ll" value={level} onChange={(e) => setLevel(e.target.value as Level | "")}>
            <option value="">الكل</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ls">القطاع</label>
          <select id="ls" value={sector} onChange={(e) => setSector(e.target.value as SectorKey | "")}>
            <option value="">الكل</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lk">المهارة</label>
          <select id="lk" value={skill} onChange={(e) => setSkill(e.target.value as SkillKey | "")}>
            <option value="">الكل</option>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {SKILL_LABELS[s].ar}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label className="check-row" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> المتاح لمستواي فقط
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="لا توجد حالات مطابقة" hint="وسّع المرشحات أو ألغِ تقييد المستوى." />
      ) : (
        <Card>
          <div className="small muted" style={{ marginBottom: "0.5rem" }}>
            {filtered.length} من {CASE_LIBRARY_SIZE} حالة
          </div>
          {filtered.map((c) => {
            const allowed = canStart(c);
            const isOpen = open === c.library_id;
            return (
              <div key={c.library_id}>
                <div className="list-item">
                  <div>
                    <b>{c.title}</b>
                    <div className="small muted">
                      {SECTOR_LABELS[c.sector]} · {SKILL_LABELS[c.skill].ar} · {CASE_TYPE_LABELS[c.case_type]} · {c.suggested_time_minutes} دقيقة · {c.data_points} بيانات
                    </div>
                  </div>
                  <div className="btn-row">
                    <Badge tone={LEVEL_TONE[c.level]}>{LEVEL_LABELS[c.level]}</Badge>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setOpen(isOpen ? null : c.library_id)} aria-expanded={isOpen}>
                      {isOpen ? "إخفاء" : "نظرة"}
                    </button>
                    {allowed ? (
                      <Link to={`/simulator?library=${encodeURIComponent(c.library_id)}&type=${c.case_type}`} className="btn btn-sm btn-primary">
                        ابدأ هذه الحالة
                      </Link>
                    ) : (
                      <span className="btn btn-sm btn-ghost" aria-disabled="true" title="تفتح عند الترقية إلى المستوى المناسب">
                        مقفلة
                      </span>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: "0.25rem 0 1rem" }}>
                    <div className="small muted">العميل: {c.client}</div>
                    <p style={{ margin: "0.35rem 0 0" }}>{c.core_problem}</p>
                    <div className="small muted" style={{ marginTop: "0.35rem" }}>
                      رمز الحالة: <code>{c.library_id}</code> · نوع المشكلة: {c.problem_type} · نوع القرار: {c.decision_type}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
