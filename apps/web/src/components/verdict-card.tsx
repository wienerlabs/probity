import Link from "next/link";
import type { ScreeningContext, VerdictRecord } from "@probity/types";
import { VerdictBadge } from "./verdict-badge";
import { TokenAvatar } from "./token-avatar";
import { formatPercent, formatRelative, truncateMiddle } from "@/lib/format";

interface Props {
  verdict: VerdictRecord;
  context: ScreeningContext;
}

export function VerdictCard({ verdict, context }: Props) {
  const meta = context.state.metadata;
  return (
    <Link
      href={`/verdict/${verdict.mint}`}
      className="surface surface-interactive p-6 block"
    >
      <div className="flex items-start gap-4">
        <TokenAvatar
          logoUrl={meta.logoUrl}
          symbol={meta.symbol}
          name={meta.name}
          mint={verdict.mint}
          size={52}
          ring
          verdictTint={verdict.verdict}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
                {meta.symbol || "—"}
              </p>
              <p className="text-lg font-semibold truncate mt-0.5">
                {meta.name || "unnamed token"}
              </p>
              <p className="mono text-xs text-[var(--color-muted)] mt-1.5 truncate">
                {truncateMiddle(verdict.mint, 10, 10)}
              </p>
            </div>
            <VerdictBadge verdict={verdict.verdict} />
          </div>
        </div>
      </div>

      <dl
        className="grid grid-cols-3 gap-3 mt-5 pt-5 text-xs"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <Stat
          label="Concentration"
          value={
            context.state.topHolderConcentration > 0
              ? formatPercent(context.state.topHolderConcentration)
              : "—"
          }
        />
        <Stat label="Computed" value={formatRelative(verdict.computedAt)} />
        <Stat label="Rule" value={`v${verdict.ruleVersion}`} />
      </dl>

      {(meta.website || meta.twitter) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          {meta.website && <span className="chip">site</span>}
          {meta.twitter && <span className="chip">twitter</span>}
          {meta.github && <span className="chip">github</span>}
          {meta.coingeckoId && <span className="chip">coingecko</span>}
        </div>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
        {label}
      </dt>
      <dd className="mono num text-[var(--color-text)] mt-0.5">{value}</dd>
    </div>
  );
}
