interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
  legend?: boolean;
  emptyLabel?: string;
}

export function Donut({
  segments,
  size = 180,
  thickness = 22,
  centerLabel,
  centerSub,
  legend = true,
  emptyLabel = "no data",
}: Props) {
  const r = size / 2 - thickness / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total <= 0) {
    return (
      <div className="flex flex-col items-center">
        <svg width={size} height={size}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={thickness}
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            className="mono num"
            fontSize={10}
            fill="var(--color-muted-2)"
          >
            {emptyLabel}
          </text>
        </svg>
      </div>
    );
  }
  let acc = -Math.PI / 2;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const start = acc;
      const end = acc + frac * Math.PI * 2;
      acc = end;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      return {
        ...s,
        frac,
        path: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      };
    });

  return (
    <div className={`flex ${legend ? "items-center gap-5" : "items-center justify-center"}`}>
      <svg width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={thickness}
        />
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.path}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            style={{ filter: `drop-shadow(0 0 6px ${a.color}88)` }}
          />
        ))}
        {centerLabel && (
          <>
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-light tracking-tight"
              fontSize={size / 6}
              fill="var(--color-text)"
            >
              {centerLabel}
            </text>
            {centerSub && (
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                letterSpacing={2}
                fill="var(--color-muted-2)"
                style={{ textTransform: "uppercase" }}
              >
                {centerSub}
              </text>
            )}
          </>
        )}
      </svg>
      {legend && (
        <ul className="space-y-1.5 text-xs">
          {arcs.map((a) => (
            <li
              key={a.label}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
            >
              <span
                aria-hidden
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: a.color, boxShadow: `0 0 6px ${a.color}` }}
              />
              <span className="text-[var(--color-muted)] truncate">{a.label}</span>
              <span className="mono num text-[var(--color-text)]">
                {(a.frac * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
