import { notFound } from "next/navigation";
import Link from "next/link";
import { findRecord } from "@/lib/screening";
import { VerdictBadge } from "@/components/verdict-badge";
import { RuleTable } from "@/components/rule-table";
import { ScoreBars } from "@/components/score-bars";
import { PriceChart } from "@/components/price-chart";
import { LookupForm } from "@/components/lookup-form";
import { formatPercent, formatRelative, truncateMiddle } from "@/lib/format";

interface PageProps {
  params: Promise<{ mint: string }>;
}

export default async function VerdictPage({ params }: PageProps) {
  const { mint } = await params;
  const r = findRecord(decodeURIComponent(mint));
  if (!r) notFound();

  const { verdict, context } = r;
  const state = context.state;
  const meta = state.metadata;

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href="/"
        className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors"
      >
        ← Dashboard
      </Link>

      <header className="mt-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
            {meta.symbol} · {meta.name}
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-light tracking-tight">
            <span className="font-semibold capitalize">{verdict.verdict}</span>{" "}
            <span className="text-[var(--color-muted)]">
              under rule v{verdict.ruleVersion}
            </span>
          </h1>
          <p className="mt-3 mono text-sm text-[var(--color-muted)]">
            {verdict.mint}
          </p>
        </div>
        <VerdictBadge verdict={verdict.verdict} size="lg" />
      </header>

      <section className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-px bg-[var(--color-border)] border border-[var(--color-border)]">
        <Meta label="Decimals" value={state.decimals.toString()} />
        <Meta label="Supply" value={state.supply} />
        <Meta
          label="Top 10 holders"
          value={formatPercent(state.topHolderConcentration)}
        />
        <Meta label="Mint authority" value={authStatus(state.mintAuthority)} />
        <Meta label="Freeze authority" value={authStatus(state.freezeAuthority)} />
      </section>

      <section className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <PriceChart
          verdict={verdict.verdict}
          price={r.priceSeries}
          holders={r.holderSeries}
        />
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
            Score breakdown
          </p>
          <ScoreBars scores={verdict.scoreBreakdown} />
          <div className="mt-6 pt-5 border-t border-[var(--color-border)] grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                Computed
              </p>
              <p className="mono mt-1 text-[var(--color-text)]">
                {formatRelative(verdict.computedAt)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                Expires
              </p>
              <p className="mono mt-1 text-[var(--color-text)]">
                {formatRelative(verdict.expiresAt).replace("ago", "from now")}
              </p>
            </div>
          </div>
          {verdict.attestationPubkey && (
            <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-xs">
                On-chain attestation
              </p>
              <p className="mono text-xs mt-1 text-[var(--color-text)] break-all">
                {truncateMiddle(verdict.attestationPubkey, 10, 10)}
              </p>
            </div>
          )}
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
            <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-xs">
              Evidence hash
            </p>
            <p className="mono text-xs mt-1 text-[var(--color-muted)] break-all">
              {verdict.evidenceHash}
            </p>
          </div>
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
            <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-xs">
              Snapshot slot
            </p>
            <p className="mono num text-sm mt-1 text-[var(--color-text)]">
              {state.snapshotSlot.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <header className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-medium">Rule outcomes</h2>
          <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {verdict.outcomes.length} rules ·{" "}
            {verdict.outcomes.filter((o) => o.outcome === "fail").length} fail ·{" "}
            {verdict.outcomes.filter((o) => o.outcome === "flag").length} flag
          </p>
        </header>
        <RuleTable outcomes={verdict.outcomes} />
      </section>

      <section className="mt-20">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
          Screen another token
        </p>
        <LookupForm />
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg)] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
        {label}
      </p>
      <p className="mono num text-sm text-[var(--color-text)] mt-1 truncate">
        {value}
      </p>
    </div>
  );
}

function authStatus(pubkey: string | null): string {
  if (pubkey === null) return "renounced";
  return truncateMiddle(pubkey, 5, 5);
}
