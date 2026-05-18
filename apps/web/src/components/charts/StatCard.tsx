interface Props {
  label: string;
  value: string | number;
  sub?: string;
  delta?: { value: number; suffix?: string; goodWhenPositive?: boolean };
  accent?: string;
  sparkline?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  accent,
  sparkline,
}: Props) {
  const deltaColor = delta
    ? delta.value === 0
      ? "var(--color-muted)"
      : (delta.value > 0) === (delta.goodWhenPositive ?? true)
        ? "var(--color-halal)"
        : "var(--color-haram)"
    : undefined;
  return (
    <div className="surface p-5 flex flex-col justify-between min-h-[120px]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
          {label}
        </p>
        {accent && (
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
          />
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-2 mt-3">
          <p className="text-3xl font-light num tracking-tight">{value}</p>
          {delta && (
            <span
              className="mono num text-xs"
              style={{ color: deltaColor }}
              title="delta vs prior window"
            >
              {delta.value >= 0 ? "+" : ""}
              {delta.value.toFixed(delta.value >= 10 ? 0 : 1)}
              {delta.suffix ?? ""}
            </span>
          )}
        </div>
        {sub && (
          <p className="text-xs text-[var(--color-muted)] mt-1">{sub}</p>
        )}
      </div>
      {sparkline && <div className="mt-3">{sparkline}</div>}
    </div>
  );
}
