interface Axis {
  label: string;
  value: number;
}

interface Props {
  axes: Axis[];
  size?: number;
  color?: string;
  rings?: number;
  threshold?: { label: string; value: number };
}

export function Radar({
  axes,
  size = 280,
  color = "var(--color-text)",
  rings = 4,
  threshold,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 32;
  const n = axes.length;
  const step = (Math.PI * 2) / n;

  const ringPaths = Array.from({ length: rings }, (_, i) => {
    const fr = (i + 1) / rings;
    return Array.from({ length: n }, (_, j) => {
      const angle = -Math.PI / 2 + j * step;
      const x = cx + Math.cos(angle) * r * fr;
      const y = cy + Math.sin(angle) * r * fr;
      return `${j === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ") + " Z";
  });

  const axisLines = Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + i * step;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return { x1: cx, y1: cy, x2: x, y2: y };
  });

  const valuePts = axes.map((a, i) => {
    const angle = -Math.PI / 2 + i * step;
    const v = Math.max(0, Math.min(1, a.value));
    const x = cx + Math.cos(angle) * r * v;
    const y = cy + Math.sin(angle) * r * v;
    return { x, y, v, label: a.label };
  });

  const polygon = valuePts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const labelPts = axes.map((a, i) => {
    const angle = -Math.PI / 2 + i * step;
    const lx = cx + Math.cos(angle) * (r + 18);
    const ly = cy + Math.sin(angle) * (r + 14);
    return { x: lx, y: ly, label: a.label, value: a.value };
  });

  const thresholdPts = threshold
    ? axes.map((_, i) => {
        const angle = -Math.PI / 2 + i * step;
        const t = threshold.value;
        const x = cx + Math.cos(angle) * r * t;
        const y = cy + Math.sin(angle) * r * t;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(" ")
    : null;

  return (
    <svg width={size} height={size} aria-hidden>
      {ringPaths.map((p, i) => (
        <path
          key={i}
          d={p}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}
      {axisLines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.45}
        />
      ))}
      {thresholdPts && (
        <polygon
          points={thresholdPts}
          fill="none"
          stroke="var(--color-mushtabah)"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.6}
        />
      )}
      <polygon
        points={polygon}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 8px ${color}44)` }}
      />
      {valuePts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={color}
          stroke="var(--color-bg)"
          strokeWidth={1}
        />
      ))}
      {labelPts.map((p, i) => (
        <g key={i}>
          <text
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            letterSpacing={1.6}
            fill="var(--color-muted)"
            style={{ textTransform: "uppercase" }}
          >
            {p.label}
          </text>
          <text
            x={p.x}
            y={p.y + 11}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="var(--color-text)"
            className="mono"
          >
            {p.value.toFixed(2)}
          </text>
        </g>
      ))}
    </svg>
  );
}
