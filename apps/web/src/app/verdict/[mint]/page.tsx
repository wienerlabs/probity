import Link from "next/link";
import {
  resolveVerdict,
  InvalidMintError,
  ScreeningConfigError,
} from "@/lib/api/screening-runtime";
import { getRecentByMint } from "@/lib/screening";
import { VerdictBadge } from "@/components/verdict-badge";
import { RuleTable } from "@/components/rule-table";
import { ScoreBars } from "@/components/score-bars";
import { LookupForm } from "@/components/lookup-form";
import { formatPercent, formatRelative, truncateMiddle } from "@/lib/format";
import type { SolanaTokenState } from "@probity/types";

interface PageProps {
  params: Promise<{ mint: string }>;
}

export const dynamic = "force-dynamic";

export default async function VerdictPage({ params }: PageProps) {
  const { mint } = await params;
  const decoded = decodeURIComponent(mint).trim();

  try {
    const r = await resolveVerdict(decoded, { useRecentCache: true });
    const verdict = r.verdict;

    // The context lives in the recent-verdicts store; we just resolved
    // and pushRecent was called, so it must be there now.
    const cached = getRecentByMint(verdict.mint);
    const state: SolanaTokenState = cached?.context.state ?? minimalState(verdict.mint);
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
          <span className="chip">source · live</span>
          <span className="chip">enrichment · {r.enrichment_source}</span>
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
            <p
              className="text-[10px] uppercase tracking-[0.2em] mb-2"
              style={{ color: "var(--color-mushtabah)" }}
            >
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
            value={
              state.topHolderConcentration > 0
                ? formatPercent(state.topHolderConcentration)
                : "—"
            }
          />
          <Meta label="Mint authority" value={authStatus(state.mintAuthority)} />
          <Meta
            label="Freeze authority"
            value={authStatus(state.freezeAuthority)}
          />
        </section>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          <div className="surface p-7 flex flex-col gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
                Revenue model
              </p>
              <p className="mt-2 mono text-sm text-[var(--color-text)]">
                {cached?.context.enrichment.revenueModel.primary ?? "—"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(cached?.context.enrichment.revenueModel.exposures ?? []).map(
                (ex, i) => (
                  <div
                    key={i}
                    className="surface-2 p-3 grid grid-cols-[1fr_auto] gap-3 items-center text-sm"
                  >
                    <span className="text-[var(--color-text)]">{ex.tag}</span>
                    <span className="mono num text-xs text-[var(--color-muted)]">
                      {(ex.revenueShare * 100).toFixed(1)}%
                    </span>
                  </div>
                ),
              )}
              {(cached?.context.enrichment.revenueModel.exposures ?? []).length ===
                0 && (
                <p className="text-sm text-[var(--color-muted)]">
                  No revenue exposures recorded.
                </p>
              )}
            </div>
            <div className="mt-2 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
                Governance
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Govern
                  label="Timelock"
                  value={
                    cached?.context.enrichment.governance.timelockSeconds
                      ? `${cached.context.enrichment.governance.timelockSeconds}s`
                      : "none"
                  }
                />
                <Govern
                  label="Multisig"
                  value={
                    cached?.context.enrichment.governance.multisigThreshold
                      ? `${cached.context.enrichment.governance.multisigThreshold.m}-of-${cached.context.enrichment.governance.multisigThreshold.n}`
                      : "none"
                  }
                />
                <Govern
                  label="Utility score"
                  value={
                    cached
                      ? cached.context.enrichment.revenueModel.utilityScore.toFixed(
                          2,
                        )
                      : "—"
                  }
                />
                <Govern
                  label="Zero-sum revenue"
                  value={
                    cached
                      ? `${(cached.context.enrichment.revenueModel.zeroSumRevenueShare * 100).toFixed(1)}%`
                      : "—"
                  }
                />
              </dl>
            </div>
          </div>
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
  } catch (e) {
    if (e instanceof InvalidMintError) {
      return (
        <ErrorPage
          tag="Invalid input"
          headline="That doesn't look like a Solana mint."
          query={decoded}
          message="Mints are 32–44 character base58 strings. Paste the exact address from Solana Explorer."
          tone="haram"
        />
      );
    }
    if (e instanceof ScreeningConfigError) {
      return (
        <ErrorPage
          tag="Screening unavailable"
          headline="Server is missing required keys."
          query={decoded}
          message={`Missing env: ${e.missing.join(", ")}. Add them to apps/web/.env.local and restart the dev server.`}
          tone="haram"
        />
      );
    }
    return (
      <ErrorPage
        tag="Live fetch error"
        headline="Couldn't resolve that mint."
        query={decoded}
        message={e instanceof Error ? e.message : String(e)}
        tone="haram"
      />
    );
  }
}

function ErrorPage({
  tag,
  headline,
  query,
  message,
  tone,
}: {
  tag: string;
  headline: string;
  query: string;
  message: string;
  tone: "haram" | "mushtabah";
}) {
  const bg = tone === "haram" ? "var(--color-haram-bg)" : "var(--color-mushtabah-bg)";
  const border =
    tone === "haram" ? "var(--color-haram-border)" : "var(--color-mushtabah-border)";
  return (
    <div className="container-page py-16 max-w-2xl">
      <Link
        href="/"
        className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors"
      >
        ← Dashboard
      </Link>
      <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
        {tag}
      </p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">
        <span className="font-semibold">{headline}</span>
      </h1>
      <p className="mt-4 mono text-sm text-[var(--color-muted)] break-all">
        {query}
      </p>
      <p
        className="mt-6 surface p-4 text-sm leading-relaxed"
        style={{ background: bg, borderColor: border }}
      >
        {message}
      </p>
      <div className="mt-8">
        <LookupForm />
      </div>
    </div>
  );
}

function minimalState(mint: string): SolanaTokenState {
  return {
    mint,
    decimals: 0,
    supply: "—",
    mintAuthority: null,
    freezeAuthority: null,
    metadata: { name: "", symbol: "", uri: "", isMutable: false },
    metadataAccount: "",
    topHolderConcentration: 0,
    topHolders: [],
    programInteractions: [],
    snapshotSlot: 0,
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

function Govern({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-[0.18em] text-[var(--color-muted-2)] text-[10px]">
        {label}
      </dt>
      <dd className="mono num text-sm text-[var(--color-text)] mt-1">{value}</dd>
    </div>
  );
}

function authStatus(pubkey: string | null): string {
  if (pubkey === null) return "renounced";
  return truncateMiddle(pubkey, 5, 5);
}
