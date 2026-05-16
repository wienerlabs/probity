import Link from "next/link";
import type { VerdictRecord } from "@/lib/types";
import { VerdictBadge } from "./verdict-badge";
import { formatPercent, formatRelative, truncateMiddle } from "@/lib/format";

export function VerdictCard({ record }: { record: VerdictRecord }) {
  return (
    <Link
      href={`/verdict/${record.mint}`}
      className="surface p-5 block hover:border-[var(--color-border-strong)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {record.token.symbol}
          </p>
          <p className="text-lg font-semibold truncate">{record.token.name}</p>
          <p className="mono text-xs text-[var(--color-muted)] mt-1 truncate">
            {truncateMiddle(record.mint, 10, 10)}
          </p>
        </div>
        <VerdictBadge verdict={record.verdict} />
      </div>

      <dl className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[var(--color-border)] text-xs">
        <Stat
          label="Concentration"
          value={formatPercent(record.token.topHolderConcentration)}
        />
        <Stat label="Computed" value={formatRelative(record.computedAt)} />
        <Stat label="Rule" value={`v${record.ruleVersion}`} />
      </dl>
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
