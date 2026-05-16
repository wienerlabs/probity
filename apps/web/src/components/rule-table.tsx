import type { RuleOutcome } from "@/lib/types";
import { CitationList } from "./citation-list";

const OUTCOME_STYLES: Record<
  RuleOutcome["outcome"],
  { label: string; color: string; bg: string; border: string }
> = {
  pass: {
    label: "Pass",
    color: "var(--color-halal)",
    bg: "var(--color-halal-bg)",
    border: "var(--color-halal-border)",
  },
  flag: {
    label: "Flag",
    color: "var(--color-mushtabah)",
    bg: "var(--color-mushtabah-bg)",
    border: "var(--color-mushtabah-border)",
  },
  fail: {
    label: "Fail",
    color: "var(--color-haram)",
    bg: "var(--color-haram-bg)",
    border: "var(--color-haram-border)",
  },
};

export function RuleTable({ outcomes }: { outcomes: RuleOutcome[] }) {
  return (
    <div className="space-y-3">
      {outcomes.map((o) => (
        <RuleRow key={o.ruleId} outcome={o} />
      ))}
    </div>
  );
}

function RuleRow({ outcome }: { outcome: RuleOutcome }) {
  const s = OUTCOME_STYLES[outcome.outcome];
  return (
    <details className="surface p-5 group" open={outcome.outcome !== "pass"}>
      <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span
              className="px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] rounded-full font-medium"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
              }}
            >
              {s.label}
            </span>
            <span className="chip">{outcome.category}</span>
            {outcome.material && (
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                material
              </span>
            )}
          </div>
          <p className="mono text-sm text-[var(--color-text)] truncate">
            {outcome.ruleId}
            <span className="text-[var(--color-muted-2)]"> @ {outcome.ruleVersion}</span>
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
            {outcome.rationale}
          </p>
        </div>
        <span
          aria-hidden
          className="text-[var(--color-muted-2)] mono text-xs select-none mt-1 group-open:rotate-90 transition-transform"
        >
          ›
        </span>
      </summary>
      <div
        className="mt-4 pt-4"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] mb-3">
          Evidence
        </p>
        <CitationList citations={outcome.evidence} />
      </div>
    </details>
  );
}
