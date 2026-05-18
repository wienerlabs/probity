interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showLast?: boolean;
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "var(--color-text)",
  fill,
  strokeWidth = 1.5,
  showDots = false,
  showLast = true,
}: Props) {
  if (values.length === 0) {
    return (
      <span className="text-[10px] text-[var(--color-muted-2)] mono">—</span>
    );
  }
  if (values.length === 1) {
    return (
      <span className="mono num text-xs text-[var(--color-muted)]">
        {values[0]!.toFixed(2)}
      </span>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 6) - 3;
    return [x, y] as const;
  });
  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = fill
    ? `${path} L${width},${height} L0,${height} Z`
    : null;
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {area && <path d={area} fill={fill} opacity={0.18} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.5} fill={color} />
        ))}
      {showLast && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2.5}
          fill={color}
          stroke="var(--color-bg)"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
