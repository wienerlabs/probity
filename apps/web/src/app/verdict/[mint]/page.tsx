import { notFound } from "next/navigation";
import Link from "next/link";
import { findVerdict } from "@/lib/mock";
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
  const record = findVerdict(decodeURIComponent(mint));
  if (!record) notFound();

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
            {record.token.symbol} · {record.token.name}
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-light tracking-tight">
            <span className="font-semibold capitalize">{record.verdict}</span>{" "}
            <span className="text-[var(--color-muted)]">
              under rule v{record.ruleVersion}
            </span>
          </h1>
          <p className="mt-3 mono text-sm text-[var(--color-muted)]">
            {record.mint}
          </p>
        </div>
        <VerdictBadge verdict={record.verdict} size="lg" />
      </header>

      <section className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-px bg-[var(--color-border)] border border-[var(--color-border)]">
        <Meta label="Decimals" value={record.token.decimals.toString()} />
        <Meta label="Supply" value={record.token.supply} />
        <Meta
          label="Top 10 holders"
          value={formatPercent(record.token.topHolderConcentration)}
        />
        <Meta label="Mint authority" value={authStatus(record.token.mintAuthority)} />
        <Meta
          label="Freeze authority"
          value={authStatus(record.token.freezeAuthority)}
        />
      </section>

      <section className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <PriceChart
          verdict={record.verdict}
          price={record.priceSeries}
          holders={record.holderSeries}
        />
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
            Score breakdown
          </p>
          <ScoreBars scores={record.scoreBreakdown} />
          <div className="mt-6 pt-5 border-t border-[var(--color-border)] grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                Computed
              </p>
              <p className="mono mt-1 text-[var(--color-text)]">
                {formatRelative(record.computedAt)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                Expires
              </p>
              <p className="mono mt-1 text-[var(--color-text)]">
                {formatRelative(record.expiresAt).replace("ago", "from now")}
              </p>
            </div>
          </div>
          {record.attestationPubkey && (
            <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-xs">
                On-chain attestation
              </p>
              <p className="mono text-xs mt-1 text-[var(--color-text)] break-all">
                {truncateMiddle(record.attestationPubkey, 10, 10)}
              </p>
            </div>
          )}
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
            <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-xs">
              Evidence hash
            </p>
            <p className="mono text-xs mt-1 text-[var(--color-muted)] break-all">
              {record.evidenceHash}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <header className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-medium">Rule outcomes</h2>
          <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {record.outcomes.length} rules · {failsCount(record)} fail ·{" "}
            {flagsCount(record)} flag
          </p>
        </header>
        <RuleTable outcomes={record.outcomes} />
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

function failsCount(r: ReturnType<typeof findVerdict>): number {
  return r?.outcomes.filter((o) => o.outcome === "fail").length ?? 0;
}
function flagsCount(r: ReturnType<typeof findVerdict>): number {
  return r?.outcomes.filter((o) => o.outcome === "flag").length ?? 0;
}
