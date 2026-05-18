interface Row {
  label: string;
  value: number;
  color?: string | undefined;
  trailingLabel?: string | undefined;
}

interface Props {
  rows: Row[];
  max?: number;
  height?: number;
  defaultColor?: string;
  emptyLabel?: string;
  format?: (v: number) => string;
}

export function HorizontalBars({
  rows,
  max,
  height = 8,
  defaultColor = "var(--color-text)",
  emptyLabel = "no data",
  format,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-2)] py-3">{emptyLabel}</p>
    );
  }
  const ceil = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const w = (Math.max(0, r.value) / ceil) * 100;
        const c = r.color ?? defaultColor;
        return (
          <li key={`${r.label}-${i}`} className="space-y-1">
            <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline text-xs">
              <span className="text-[var(--color-text)] truncate">{r.label}</span>
              <span className="mono num text-[var(--color-muted)]">
                {format ? format(r.value) : r.value.toFixed(2)}
                {r.trailingLabel ? (
                  <span className="text-[var(--color-muted-2)] ml-1.5">
                    {r.trailingLabel}
                  </span>
                ) : null}
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{
                height,
                background: "color-mix(in oklab, var(--color-text) 6%, transparent)",
              }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, w)}%`,
                  background: c,
                  boxShadow: `0 0 10px -2px ${c}`,
                  transition: "width 240ms ease",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
