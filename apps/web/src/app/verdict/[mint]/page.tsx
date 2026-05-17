import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveVerdict } from "@/lib/api/screening-runtime";
import { VerdictBadge } from "@/components/verdict-badge";
import { RuleTable } from "@/components/rule-table";
import { ScoreBars } from "@/components/score-bars";
import { PriceChart } from "@/components/price-chart";
import { LookupForm } from "@/components/lookup-form";
import { formatPercent, formatRelative, truncateMiddle } from "@/lib/format";

interface PageProps {
  params: Promise<{ mint: string }>;
}

export const dynamic = "force-dynamic";

export default async function VerdictPage({ params }: PageProps) {
  const { mint } = await params;
  let r;
  try {
    r = await resolveVerdict(decodeURIComponent(mint));
  } catch (e) {
    // Live fetch threw — surface inline rather than the bare 404 page.
    return <LiveError query={decodeURIComponent(mint)} message={(e as Error).message} />;
  }
  if (!r) notFound();

  const verdict = r.verdict;
  // Fixture records always carry a SolanaTokenState in their context;
  // live records inherit the state from the engine input (still present
  // because resolveVerdict() built the ScreeningContext). To support both
  // sources we read the state via the engine outcomes / record envelope.
  const state =
    (r.source === "fixture" && r.priceSeries
      ? (await import("@/lib/screening")).findRecord(decodeURIComponent(mint))!.context.state
      : (await import("@/lib/screening")).findRecord(decodeURIComponent(mint))?.context.state) ??
    inferStateFromLive(r);
  const meta = state.metadata;

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href="/"
        className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors"
      >
        ← Dashboard
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="chip">
          source · {r.source}
        </span>
        {r.enrichment_source && (
          <span className="chip">enrichment · {r.enrichment_source}</span>
        )}
        <span className="chip">rule v{verdict.ruleVersion}</span>
      </div>

      <header className="mt-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
            {meta.symbol || "—"} · {meta.name || "unnamed token"}
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-light tracking-tight">
            <span className="font-semibold capitalize">{verdict.verdict}</span>{" "}
            <span className="text-[var(--color-muted)]">
              under rule v{verdict.ruleVersion}
            </span>
          </h1>
          <p className="mt-3 mono text-sm text-[var(--color-muted)] break-all">
            {verdict.mint}
          </p>
        </div>
        <VerdictBadge verdict={verdict.verdict} size="lg" glow />
      </header>

      {r.warnings && r.warnings.length > 0 && (
        <section
          className="mt-8 surface p-4 text-sm leading-relaxed"
          style={{
            background: "var(--color-mushtabah-bg)",
            borderColor: "var(--color-mushtabah-border)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "var(--color-mushtabah)" }}>
            Provisional verdict
          </p>
          <ul className="space-y-1 text-[var(--color-muted)]">
            {r.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 grid grid-cols-2 md:grid-cols-5 grid-bordered">
        <Meta label="Decimals" value={state.decimals.toString()} />
        <Meta label="Supply" value={state.supply} />
        <Meta
          label="Top 10 holders"
          value={state.topHolderConcentration > 0
            ? formatPercent(state.topHolderConcentration)
            : "—"}
        />
        <Meta label="Mint authority" value={authStatus(state.mintAuthority)} />
        <Meta label="Freeze authority" value={authStatus(state.freezeAuthority)} />
      </section>

      <section className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        {r.priceSeries && r.holderSeries ? (
          <PriceChart
            verdict={verdict.verdict}
            price={r.priceSeries}
            holders={r.holderSeries}
          />
        ) : (
          <div className="surface p-8 flex flex-col justify-center min-h-[380px]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
              Price chart unavailable
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed max-w-md">
              Live verdicts skip the OHLC chart — Probity ingests on-chain
              state + off-chain documents, not market data. Pair this verdict
              with your usual exchange chart for price context.
            </p>
          </div>
        )}
        <div className="surface p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
            Score breakdown
          </p>
          <ScoreBars scores={verdict.scoreBreakdown} />
          <Divider />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-[10px]">
                Computed
              </p>
              <p className="mono mt-1 text-[var(--color-text)]">
                {formatRelative(verdict.computedAt)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-[10px]">
                Expires
              </p>
              <p className="mono mt-1 text-[var(--color-text)]">
                {formatRelative(verdict.expiresAt).replace("ago", "from now")}
              </p>
            </div>
          </div>
          {verdict.attestationPubkey && (
            <>
              <Divider />
              <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-[10px]">
                On-chain attestation
              </p>
              <p className="mono text-xs mt-1 text-[var(--color-text)] break-all">
                {truncateMiddle(verdict.attestationPubkey, 10, 10)}
              </p>
            </>
          )}
          <Divider />
          <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-[10px]">
            Evidence hash
          </p>
          <p className="mono text-xs mt-1 text-[var(--color-muted)] break-all">
            {verdict.evidenceHash}
          </p>
          <Divider />
          <p className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-[10px]">
            Snapshot slot
          </p>
          <p className="mono num text-sm mt-1 text-[var(--color-text)]">
            {state.snapshotSlot.toLocaleString()}
          </p>
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
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
          Screen another token
        </p>
        <LookupForm />
      </section>
    </div>
  );
}

function LiveError({ query, message }: { query: string; message: string }) {
  return (
    <div className="container-page py-16 max-w-2xl">
      <Link
        href="/"
        className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors"
      >
        ← Dashboard
      </Link>
      <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
        Live fetch error
      </p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">
        <span className="font-semibold">Couldn&apos;t resolve</span>{" "}
        <span className="text-[var(--color-muted)]">that mint.</span>
      </h1>
      <p className="mt-4 mono text-sm text-[var(--color-muted)] break-all">
        {query}
      </p>
      <p
        className="mt-6 surface p-4 text-sm leading-relaxed"
        style={{
          background: "var(--color-haram-bg)",
          borderColor: "var(--color-haram-border)",
        }}
      >
        {message}
      </p>
      <div className="mt-8">
        <LookupForm />
      </div>
    </div>
  );
}

// Synthesise a minimal SolanaTokenState envelope from the engine's
// outcomes for live verdicts when the fixture lookup misses. We pull
// whatever on-chain evidence the engine recorded; if the engine didn't
// see it, the field gracefully reads "—".
function inferStateFromLive(r: { verdict: { mint: string; outcomes: { evidence: { type: string; account?: string; field?: string; value?: string; slot?: number }[] }[] } }) {
  // Walk evidence to recover what we can.
  let snapshotSlot = 0;
  let mintAuthority: string | null = null;
  let freezeAuthority: string | null = null;
  let isMutable = false;
  for (const o of r.verdict.outcomes) {
    for (const ev of o.evidence) {
      if (ev.type !== "onchain") continue;
      if (typeof ev.slot === "number" && ev.slot > snapshotSlot) snapshotSlot = ev.slot;
      if (ev.field === "mint_authority") {
        mintAuthority = ev.value && ev.value !== "null" ? ev.value : null;
      }
      if (ev.field === "freeze_authority") {
        freezeAuthority = ev.value && ev.value !== "null" ? ev.value : null;
      }
      if (ev.field === "is_mutable") {
        isMutable = ev.value === "true";
      }
    }
  }
  return {
    mint: r.verdict.mint,
    decimals: 0,
    supply: "—",
    mintAuthority,
    freezeAuthority,
    metadata: {
      name: "",
      symbol: "",
      uri: "",
      isMutable,
    },
    metadataAccount: "",
    topHolderConcentration: 0,
    topHolders: [],
    programInteractions: [],
    snapshotSlot,
  };
}

function Divider() {
  return (
    <div
      className="my-5"
      style={{ borderTop: "1px solid var(--color-border)" }}
    />
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
        {label}
      </p>
      <p className="mono num text-sm text-[var(--color-text)] mt-1.5 truncate">
        {value}
      </p>
    </div>
  );
}

function authStatus(pubkey: string | null): string {
  if (pubkey === null) return "renounced";
  return truncateMiddle(pubkey, 5, 5);
}
