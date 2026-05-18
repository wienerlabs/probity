import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { VerdictCard } from "@/components/verdict-card";
import { VerdictBadge } from "@/components/verdict-badge";
import {
  getProgramKindAggregates,
  getRecent,
  getRecentByMint,
  getRecentChanges,
  getSectorAggregates,
  getStats,
} from "@/lib/screening";
import { TokenAvatar } from "@/components/token-avatar";
import {
  Donut,
  HorizontalBars,
  Sparkline,
  StatCard,
  Treemap,
} from "@/components/charts";
import { formatRelative, truncateMiddle } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUICK_EXAMPLES: { mint: string; label: string }[] = [
  { mint: "So11111111111111111111111111111111111111112", label: "wSOL" },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", label: "USDC" },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", label: "JUP" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", label: "BONK" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", label: "WIF" },
  { mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", label: "PYUSD" },
];

const HARAM_TAGS = new Set([
  "alcohol",
  "gambling",
  "adult",
  "tobacco",
  "weapons",
  "conventional-finance",
  "pork",
  "lending-interest",
]);

function sectorColor(tag: string): string {
  if (HARAM_TAGS.has(tag)) return "var(--color-haram)";
  if (tag === "primary-utility" || tag === "infra")
    return "var(--color-halal)";
  return "var(--color-mushtabah)";
}

function kindPalette(kind: string): string {
  if (kind === "amm-swap" || kind === "marketplace")
    return "var(--color-halal)";
  if (kind === "lending-interest-bearing") return "var(--color-haram)";
  if (kind === "lending-collateral-only") return "var(--color-mushtabah)";
  if (kind === "staking" || kind === "governance")
    return "var(--color-text)";
  return "var(--color-muted-2)";
}

export default function HomePage() {
  const recent = getRecent(12);
  const stats = getStats();
  const sectors = getSectorAggregates(60).slice(0, 8);
  const programKinds = getProgramKindAggregates(60);
  const recentChanges = getRecentChanges(8);

  const counts = {
    halal: recent.filter((r) => r.verdict.verdict === "halal").length,
    mushtabah: recent.filter((r) => r.verdict.verdict === "mushtabah").length,
    haram: recent.filter((r) => r.verdict.verdict === "haram").length,
  };

  const donutSegments = [
    { label: "Halal", value: counts.halal, color: "var(--color-halal)" },
    {
      label: "Mushtabah",
      value: counts.mushtabah,
      color: "var(--color-mushtabah)",
    },
    { label: "Haram", value: counts.haram, color: "var(--color-haram)" },
  ];

  const haramPct = stats.uniqueMints
    ? ((counts.haram / stats.uniqueMints) * 100)
    : 0;
  const utilityScores = recent.map(
    (r) => r.consensus?.confidence ?? 0,
  );
  const trendValues = utilityScores.length
    ? utilityScores.slice().reverse()
    : [0];

  return (
    <div className="container-page py-14 md:py-20">
      <section className="max-w-3xl">
        <span className="chip mb-6">Live · rule v0.1.0 · mainnet</span>
        <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-[1.05]">
          The compliance verdict on{" "}
          <span className="font-semibold">every Solana token.</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
          Helius RPC pulls the chain. Jupiter, Birdeye, CoinGecko, and the
          issuer&apos;s own homepage feed Claude. Three consensus runs vote
          on revenue and governance. The engine writes a verdict you can
          audit citation-by-citation.
        </p>
        <div className="mt-10">
          <LookupForm />
          <p className="mt-4 text-xs text-[var(--color-muted-2)]">
            Try{" "}
            {QUICK_EXAMPLES.map((e, i) => (
              <span key={e.mint}>
                <Link
                  href={`/verdict/${e.mint}`}
                  className="mono hover:text-[var(--color-text)] underline-offset-4 hover:underline"
                >
                  {e.label}
                </Link>
                {i < QUICK_EXAMPLES.length - 1 ? ", " : "."}
              </span>
            ))}{" "}
            First lookup ≈10s (Helius + Claude pipeline); subsequent reads ≈10ms.
          </p>
        </div>
      </section>

      <section className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Verdicts written"
          value={stats.totalVerdicts.toLocaleString()}
          sub={`${stats.uniqueMints} unique mints`}
          accent="var(--color-text)"
        />
        <StatCard
          label="Last 24 hours"
          value={stats.last24hScans.toLocaleString()}
          sub="screenings"
          accent="var(--color-halal)"
          sparkline={
            <Sparkline
              values={trendValues}
              width={140}
              height={28}
              color="var(--color-halal)"
              fill="var(--color-halal)"
            />
          }
        />
        <StatCard
          label="Haram share"
          value={`${haramPct.toFixed(0)}%`}
          sub={`${counts.haram} of ${recent.length || stats.uniqueMints} latest`}
          accent="var(--color-haram)"
          {...(recent.length
            ? {
                delta: {
                  value: haramPct - 33.3,
                  suffix: "% vs even split",
                  goodWhenPositive: false,
                },
              }
            : {})}
        />
        <StatCard
          label="Avg consensus"
          value={
            stats.avgConsensusConfidence
              ? (stats.avgConsensusConfidence * 100).toFixed(0) + "%"
              : "—"
          }
          sub={`${stats.totalChanges} verdict change${stats.totalChanges === 1 ? "" : "s"} recorded`}
          accent="var(--color-mushtabah)"
        />
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="surface p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
            Verdict distribution · latest per mint
          </p>
          <Donut
            segments={donutSegments}
            size={210}
            thickness={26}
            centerLabel={(counts.halal + counts.mushtabah + counts.haram).toString()}
            centerSub="verdicts"
          />
        </div>
        <div className="surface p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
              Sector exposure · summed across {sectors.length} tags
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
              haram-tinted · sector pool
            </p>
          </div>
          <HorizontalBars
            rows={sectors.map((s) => ({
              label: s.tag,
              value: s.total_share,
              color: sectorColor(s.tag),
              trailingLabel: `${s.mentions}×`,
            }))}
            max={Math.max(...sectors.map((s) => s.total_share), 1)}
            format={(v) => `${v.toFixed(2)}`}
            emptyLabel="No sector exposures aggregated yet — screen a mint to start the feed."
          />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
            Program kinds · all observed mints
          </p>
          {programKinds.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-2)]">
              No program interactions ingested yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-6 items-center">
              <Donut
                segments={programKinds.map((k) => ({
                  label: k.kind,
                  value: k.mentions,
                  color: kindPalette(k.kind),
                }))}
                size={170}
                thickness={20}
                centerLabel={programKinds.reduce((a, b) => a + b.mentions, 0).toString()}
                centerSub="hits"
                legend={false}
              />
              <HorizontalBars
                rows={programKinds.map((k) => ({
                  label: k.kind,
                  value: k.mentions,
                  color: kindPalette(k.kind),
                }))}
                format={(v) => `${v}×`}
              />
            </div>
          )}
        </div>
        <div className="surface p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
            Recent verdict changes · cross-mint feed
          </p>
          {recentChanges.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-2)]">
              Probity hasn&apos;t observed a verdict change yet — every mint
              has been screened only once.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {recentChanges.map((c) => {
                const cachedRow = getRecentByMint(c.mint);
                const m = cachedRow?.context.state.metadata;
                return (
                  <li
                    key={c.id}
                    className="surface-2 p-3.5 grid grid-cols-[auto_1fr_auto] gap-3 items-center text-xs"
                  >
                    <TokenAvatar
                      logoUrl={m?.logoUrl}
                      symbol={m?.symbol}
                      name={m?.name}
                      mint={c.mint}
                      size={36}
                      verdictTint={c.newVerdict}
                      ring
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/verdict/${c.mint}`}
                        className="text-[var(--color-text)] hover:underline truncate block"
                      >
                        <span className="font-medium">
                          {m?.symbol || truncateMiddle(c.mint, 6, 6)}
                        </span>
                        {m?.name && (
                          <span className="text-[var(--color-muted)] ml-2">
                            {m.name}
                          </span>
                        )}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {c.previousVerdict && (
                          <>
                            <VerdictBadge
                              verdict={c.previousVerdict}
                              size="sm"
                            />
                            <span
                              aria-hidden
                              className="text-[var(--color-muted-2)]"
                            >
                              →
                            </span>
                          </>
                        )}
                        <VerdictBadge verdict={c.newVerdict} size="sm" />
                      </div>
                    </div>
                    <span className="text-[var(--color-muted-2)] text-right text-[11px]">
                      {formatRelative(c.detectedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-12">
        <header className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-medium">Recently screened</h2>
          <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {recent.length} {recent.length === 1 ? "token" : "tokens"} · live
          </p>
        </header>
        {recent.length === 0 ? (
          <div className="surface p-10 text-center">
            <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
              Nothing screened yet. Paste a mint above or try one of the
              examples — verdicts persist here in SQLite for this server.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {recent.map((r) => (
              <VerdictCard
                key={r.verdict.mint}
                verdict={r.verdict}
                context={r.context}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16">
        <header className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-medium">Coverage map</h2>
          <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            sector pool · proportional area
          </p>
        </header>
        <div className="surface p-5">
          <Treemap
            cells={sectors.map((s) => ({
              label: s.tag,
              value: s.total_share,
              color: sectorColor(s.tag),
              detail: `${(s.total_share).toFixed(2)} · ${s.mentions}×`,
            }))}
            width={1100}
            height={260}
            emptyLabel="Sector pool empty — screen a few mints to fill the map."
          />
        </div>
      </section>

      <section className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FrameworkBlock
          label="Halal"
          verdict="halal"
          text="Clears every material rule — riba, maysir, haram-sector, and gharar. Non-material rules without unresolved fails."
        />
        <FrameworkBlock
          label="Mushtabah"
          verdict="mushtabah"
          text="Doubtful. A material rule is flagged, or a non-material rule fails. Requires deeper human review before a position is taken."
        />
        <FrameworkBlock
          label="Haram"
          verdict="haram"
          text="A material rule fails outright. Cannot be cleared under standard Islamic finance principles."
        />
      </section>
    </div>
  );
}

function FrameworkBlock({
  verdict,
  label,
  text,
}: {
  verdict: "halal" | "mushtabah" | "haram";
  label: string;
  text: string;
}) {
  return (
    <div className="surface p-6">
      <VerdictBadge verdict={verdict} glow />
      <p className="mt-5 text-lg font-medium">{label}</p>
      <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
