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
    <div className="space-y-3">
      {entries.map(([key, label]) => {
        const v = scores[key];
        return (
          <div key={key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
              {label}
            </span>
            <div className="h-1.5 bg-[rgba(255,255,255,0.05)] relative overflow-hidden rounded-[1px]">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(2, v * 100)}%`,
                  background: colorForScore(v),
                  transition: "width 240ms ease",
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
