import type { RuleOutcome } from "@/lib/types";
import { CitationList } from "./citation-list";

const OUTCOME_STYLES: Record<
  RuleOutcome["outcome"],
  { label: string; color: string; bg: string; border: string }
> = {
  pass: {
    label: "Pass",
    color: "var(--color-halal)",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.32)",
  },
  flag: {
    label: "Flag",
    color: "var(--color-mushtabah)",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.32)",
  },
  fail: {
    label: "Fail",
    color: "var(--color-haram)",
    bg: "rgba(244, 63, 94, 0.08)",
    border: "rgba(244, 63, 94, 0.32)",
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
    <details className="surface p-4 group" open={outcome.outcome !== "pass"}>
      <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <span
              className="px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] rounded-[2px]"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
              }}
            >
              {s.label}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
              {outcome.category}
            </span>
            {outcome.material && (
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                · material
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
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted-2)] mb-3">
          Evidence
        </p>
        <CitationList citations={outcome.evidence} />
      </div>
    </details>
  );
}
