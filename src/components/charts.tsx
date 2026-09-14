// ============================================================
// مخططات SVG خفيفة (بلا اعتماديات): خط تطور الأداء، وأعمدة الأبعاد
// ============================================================
import { DIMENSIONS, DIMENSION_LABELS, type DimensionScores } from "../../shared/types.ts";
import { DIMENSION_WEIGHTS } from "../../shared/rubric.ts";
import { ProgressBar } from "./ui.tsx";

export function LineChart({ points, label, height = 180 }: { points: { x: string; y: number }[]; label: string; height?: number }) {
  const w = 640;
  const h = height;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  if (points.length === 0) return <p className="muted">لا توجد بيانات كافية للمخطط بعد.</p>;
  const xs = points.map((_, i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, points.length - 1));
  const ys = points.map((p) => pad.t + ((100 - p.y) * (h - pad.t - pad.b)) / 100);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${d} L${xs[xs.length - 1].toFixed(1)},${(h - pad.b).toFixed(1)} L${xs[0].toFixed(1)},${(h - pad.b).toFixed(1)} Z`;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <title>{label}</title>
      {[0, 25, 50, 70, 100].map((v) => {
        const y = pad.t + ((100 - v) * (h - pad.t - pad.b)) / 100;
        return (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke={v === 70 ? "#c9a227" : "#e3e8e5"} strokeDasharray={v === 70 ? "4 4" : undefined} />
            <text x={pad.l - 6} y={y + 4} fontSize="11" textAnchor="end" fill="#6b7570">
              {v}
            </text>
          </g>
        );
      })}
      <path d={area} fill="rgba(31,111,74,0.12)" />
      <path d={d} fill="none" stroke="#1f6f4a" strokeWidth="2.5" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={ys[i]} r="4" fill="#0f3d2e" />
          <title>{`${points[i].x}: ${points[i].y}`}</title>
        </g>
      ))}
      {points.length <= 12 &&
        xs.map((x, i) => (
          <text key={`l${i}`} x={x} y={h - 8} fontSize="10" textAnchor="middle" fill="#6b7570">
            {points[i].x}
          </text>
        ))}
    </svg>
  );
}

export function DimensionBars({ scores }: { scores: DimensionScores }) {
  return (
    <div>
      {DIMENSIONS.map((d) => (
        <div className="dim-row" key={d}>
          <span className="dim-label">
            {DIMENSION_LABELS[d]} <span className="muted small">({DIMENSION_WEIGHTS[d]}%)</span>
          </span>
          <ProgressBar value={scores[d]} tone={scores[d] < 55 ? "red" : scores[d] < 70 ? "gold" : undefined} label={DIMENSION_LABELS[d]} />
          <span className="dim-score">{Math.round(scores[d])}</span>
        </div>
      ))}
    </div>
  );
}
