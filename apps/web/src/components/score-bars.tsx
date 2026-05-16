import type { VerdictRecord } from "@/lib/types";

const LABELS: Record<keyof VerdictRecord["scoreBreakdown"], string> = {
  riba: "Riba",
  maysir: "Maysir",
  gharar: "Gharar",
  sector: "Haram sector",
  governance: "Governance",
  transparency: "Transparency",
};

function colorForScore(v: number): string {
  if (v >= 0.85) return "var(--color-halal)";
  if (v >= 0.5) return "var(--color-mushtabah)";
  return "var(--color-haram)";
}

export function ScoreBars({
  scores,
}: {
  scores: VerdictRecord["scoreBreakdown"];
}) {
  const entries = Object.entries(LABELS) as [
    keyof VerdictRecord["scoreBreakdown"],
    string,
  ][];
  return (
    <div className="space-y-3.5">
      {entries.map(([key, label]) => {
        const v = scores[key];
        const c = colorForScore(v);
        return (
          <div key={key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
              {label}
            </span>
            <div
              className="h-2 rounded-full relative overflow-hidden"
              style={{
                background:
                  "color-mix(in oklab, var(--color-text) 6%, transparent)",
              }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, v * 100)}%`,
                  background: c,
                  boxShadow: `0 0 12px -2px ${c}`,
                  transition: "width 260ms ease",
                }}
              />
            </div>
            <span className="mono num text-xs text-[var(--color-muted)] text-right">
              {v.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
