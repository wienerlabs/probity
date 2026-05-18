interface Props {
  value: number;
  size?: number;
  thickness?: number;
  label?: string;
  sub?: string;
  thresholds?: { warn: number; bad: number };
}

export function Gauge({
  value,
  size = 200,
  thickness = 14,
  label,
  sub,
  thresholds = { warn: 0.85, bad: 0.65 },
}: Props) {
  const cx = size / 2;
  const cy = size / 2 + size / 12;
  const r = size / 2 - thickness / 2 - 4;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const v = Math.max(0, Math.min(1, value));
  const fillEnd = startAngle + (endAngle - startAngle) * v;

  let color = "var(--color-halal)";
  let glow = "var(--color-halal-glow)";
  if (v < thresholds.bad) {
    color = "var(--color-haram)";
    glow = "var(--color-haram-glow)";
  } else if (v < thresholds.warn) {
    color = "var(--color-mushtabah)";
    glow = "var(--color-mushtabah-glow)";
  }

  function point(angle: number, radius = r) {
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  }
  function arcPath(a0: number, a1: number) {
    const p0 = point(a0);
    const p1 = point(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }

  const ticks = [thresholds.bad, thresholds.warn].map((t) => {
    const a = startAngle + (endAngle - startAngle) * t;
    const inner = point(a, r - thickness / 2 - 1);
    const outer = point(a, r + thickness / 2 + 4);
    return { inner, outer, value: t };
  });

  return (
    <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`} aria-hidden>
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={thickness}
        strokeLinecap="round"
      />
      <path
        d={arcPath(startAngle, fillEnd)}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(${glow})` }}
      />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.inner.x}
          y1={t.inner.y}
          x2={t.outer.x}
          y2={t.outer.y}
          stroke="var(--color-muted-2)"
          strokeWidth={1}
          opacity={0.6}
        />
      ))}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 5.5}
        className="font-light"
        fill="var(--color-text)"
      >
        {(v * 100).toFixed(0)}
        <tspan fontSize={size / 12} dy={-6} fill="var(--color-muted-2)">
          %
        </tspan>
      </text>
      {label && (
        <text
          x={cx}
          y={cy + size / 9}
          textAnchor="middle"
          fontSize={9}
          letterSpacing={2}
          fill="var(--color-muted-2)"
          style={{ textTransform: "uppercase" }}
        >
          {label}
        </text>
      )}
      {sub && (
        <text
          x={cx}
          y={cy + size / 9 + 13}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-muted)"
        >
          {sub}
        </text>
      )}
    </svg>
  );
}
