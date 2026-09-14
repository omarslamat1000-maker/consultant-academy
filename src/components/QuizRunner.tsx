// ============================================================
// عارض أسئلة الاختبار — يدعم جميع أنواع الأسئلة، مع إمكانية الوصول عبر لوحة المفاتيح
// ============================================================
import type { GradedAnswer } from "../../shared/quiz-grader.ts";
import { QUESTION_TYPE_LABELS, type QuizOption, type QuizQuestion, type QuizUserAnswer, type TableData } from "../../shared/types.ts";
import { Badge } from "./ui.tsx";

interface Props {
  questions: QuizQuestion[];
  answers: Record<string, QuizUserAnswer>;
  onChange: (id: string, a: QuizUserAnswer) => void;
  disabled?: boolean;
  graded?: GradedAnswer[];
}

function optionsOf(q: QuizQuestion): QuizOption[] {
  if (Array.isArray(q.options)) return q.options;
  if ("choices" in q.options && q.options.choices) return q.options.choices;
  return [];
}

function TableView({ table }: { table: TableData }) {
  return (
    <div className="table-wrap" style={{ marginBottom: "0.75rem" }}>
      <table>
        {table.caption && <caption className="muted small">{table.caption}</caption>}
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuizRunner({ questions, answers, onChange, disabled, graded }: Props) {
  const gradedMap = new Map((graded ?? []).map((g) => [g.question_id, g]));
  return (
    <div>
      {questions.map((q, idx) => {
        const a = answers[q.id];
        const g = gradedMap.get(q.id);
        return (
          <fieldset key={q.id} className="card" style={{ border: g ? `1px solid ${g.correct ? "#bcdcc9" : g.partial > 0 ? "#ecd9a0" : "#f0c3bf"}` : undefined }} disabled={disabled}>
            <legend style={{ fontWeight: 700, color: "var(--green-800)" }}>
              السؤال {idx + 1} <Badge>{QUESTION_TYPE_LABELS[q.question_type]}</Badge>
            </legend>
            <p style={{ whiteSpace: "pre-wrap" }}>{q.question}</p>
            {!Array.isArray(q.options) && "table" in q.options && q.options.table && <TableView table={q.options.table} />}
            {renderInput(q, a, (v) => onChange(q.id, v))}
            {g && (
              <div className={`alert ${g.correct ? "alert-success" : g.partial > 0 ? "alert-warn" : "alert-error"}`} style={{ marginTop: "0.75rem" }}>
                <div>
                  <b>{g.correct ? "إجابة صحيحة" : g.partial > 0 ? `إجابة جزئية (${Math.round(g.partial * 100)}%)` : "إجابة غير صحيحة"}</b>
                  {g.expected_summary && (
                    <div className="small">
                      الإجابة المتوقعة: <b>{g.expected_summary}</b>
                    </div>
                  )}
                  {g.explanation && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{g.explanation}</div>}
                </div>
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

function renderInput(q: QuizQuestion, a: QuizUserAnswer | undefined, set: (v: QuizUserAnswer) => void) {
  const opts = optionsOf(q);
  switch (q.question_type) {
    case "mcq":
    case "spot_error":
    case "best_issue_tree":
    case "best_hypothesis":
    case "table_reading": {
      if (opts.length === 0) {
        return <input type="number" inputMode="decimal" dir="ltr" value={a && "value" in a && typeof a.value === "number" ? a.value : ""} onChange={(e) => set({ value: Number(e.target.value) })} aria-label="الإجابة الرقمية" />;
      }
      const sel = a && "option" in a ? a.option : "";
      return (
        <div>
          {opts.map((o) => (
            <label key={o.id} className={`check-row ${sel === o.id ? "selected" : ""}`}>
              <input type="radio" name={q.id} value={o.id} checked={sel === o.id} onChange={() => set({ option: o.id })} />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );
    }
    case "most_important_data": {
      const sel = new Set(a && "options" in a ? a.options : []);
      return (
        <div>
          {opts.map((o) => (
            <label key={o.id} className={`check-row ${sel.has(o.id) ? "selected" : ""}`}>
              <input
                type="checkbox"
                checked={sel.has(o.id)}
                onChange={(e) => {
                  const n = new Set(sel);
                  if (e.target.checked) n.add(o.id);
                  else n.delete(o.id);
                  set({ options: [...n] });
                }}
              />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );
    }
    case "true_false": {
      const val = a && "value" in a && typeof a.value === "boolean" ? a.value : null;
      const expl = a && "explanation" in a ? (a.explanation ?? "") : "";
      return (
        <div>
          <label className={`check-row ${val === true ? "selected" : ""}`}>
            <input type="radio" name={q.id} checked={val === true} onChange={() => set({ value: true, explanation: expl })} /> صحيح
          </label>
          <label className={`check-row ${val === false ? "selected" : ""}`}>
            <input type="radio" name={q.id} checked={val === false} onChange={() => set({ value: false, explanation: expl })} /> خطأ
          </label>
          <label className="small muted" htmlFor={`${q.id}-expl`}>
            التفسير (اختياري)
          </label>
          <textarea id={`${q.id}-expl`} style={{ minHeight: 70 }} value={expl} onChange={(e) => set({ value: val ?? false, explanation: e.target.value })} />
        </div>
      );
    }
    case "ordering": {
      const order = a && "order" in a ? a.order : opts.map((o) => o.id);
      const move = (i: number, dir: -1 | 1) => {
        const n = [...order];
        const j = i + dir;
        if (j < 0 || j >= n.length) return;
        [n[i], n[j]] = [n[j], n[i]];
        set({ order: n });
      };
      return (
        <ol className="ordering-list" aria-label="رتّب العناصر">
          {order.map((id, i) => {
            const o = opts.find((x) => x.id === id);
            return (
              <li key={id}>
                <span className="num">{i + 1}</span>
                <span className="grow">{o?.text ?? id}</span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => move(i, -1)} aria-label="تحريك لأعلى" disabled={i === 0}>
                  ↑
                </button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => move(i, 1)} aria-label="تحريك لأسفل" disabled={i === order.length - 1}>
                  ↓
                </button>
              </li>
            );
          })}
          {!(a && "order" in a) && (
            <li style={{ border: "none", background: "transparent" }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ order })}>
                اعتماد هذا الترتيب
              </button>
            </li>
          )}
        </ol>
      );
    }
    case "matching": {
      if (Array.isArray(q.options) || !("left" in q.options)) return null;
      const { left, right } = q.options;
      const pairs = a && "pairs" in a ? a.pairs : {};
      return (
        <div>
          {left.map((l) => (
            <div className="matching-row" key={l.id}>
              <label htmlFor={`${q.id}-${l.id}`}>{l.text}</label>
              <select id={`${q.id}-${l.id}`} value={pairs[l.id] ?? ""} onChange={(e) => set({ pairs: { ...pairs, [l.id]: e.target.value } })}>
                <option value="">— اختر —</option>
                {right.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case "numeric":
      return (
        <input
          type="number"
          step="any"
          inputMode="decimal"
          dir="ltr"
          value={a && "value" in a && typeof a.value === "number" ? a.value : ""}
          onChange={(e) => set({ value: Number(e.target.value) })}
          aria-label="الإجابة الرقمية"
          style={{ maxWidth: 240 }}
        />
      );
    default:
      return <textarea value={a && "text" in a ? a.text : ""} onChange={(e) => set({ text: e.target.value })} aria-label="إجابتك" placeholder="اكتب إجابتك هنا…" />;
  }
}
