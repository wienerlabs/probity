import Link from "next/link";
import {
  resolveVerdict,
  InvalidMintError,
  ScreeningConfigError,
} from "@/lib/api/screening-runtime";
import { getChanges, getHistory, getRecentByMint } from "@/lib/screening";
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
    const history = getHistory(verdict.mint, 25);
    const changes = getChanges(verdict.mint, 15);

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
          {r.evidence && (
            <>
              <span className="chip">
                {r.evidence.scannedTransactions} tx scanned
              </span>
              <span className="chip">
                {r.evidence.documentsIngested} doc
                {r.evidence.documentsIngested === 1 ? "" : "s"} ingested
              </span>
              <span className="chip">
                {r.evidence.knownPrograms +
                  r.evidence.unknownPrograms}{" "}
                programs touched
              </span>
            </>
          )}
          {r.consensus && (
            <ConfidenceChip
              confidence={r.consensus.confidence}
              runs={r.consensus.runs}
            />
          )}
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

        {r.consensus && (
          <section className="mt-12">
            <header className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-medium">Cross-run consensus</h2>
              <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                {r.consensus.runs}× Claude · confidence {r.consensus.confidence.toFixed(2)}
              </p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="surface p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
                  Sector exposure agreement
                </p>
                {r.consensus.sectorAgreements.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    No sector exposures emitted in any run.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {r.consensus.sectorAgreements.map((s) => (
                      <li
                        key={s.tag}
                        className="surface-2 p-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-xs"
                      >
                        <span className="text-[var(--color-text)]">{s.tag}</span>
                        <span
                          className="px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-full border text-[var(--color-muted)]"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          {s.occurrences}/{r.consensus!.runs}
                        </span>
                        <span className="mono num text-[var(--color-muted)]">
                          med {(s.shareMedian * 100).toFixed(1)}%
                        </span>
                        <span
                          className="mono num text-[var(--color-muted-2)]"
                          title={`min ${(s.shareMin * 100).toFixed(1)}% / max ${(s.shareMax * 100).toFixed(1)}%`}
                        >
                          σ {(s.shareStddev * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div
                  className="mt-5 pt-4"
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <Govern
                      label="Utility score"
                      value={`med ${r.consensus.utilityScoreMedian.toFixed(2)} · σ ${r.consensus.utilityScoreStddev.toFixed(2)}`}
                    />
                    <Govern
                      label="Zero-sum share"
                      value={`med ${(r.consensus.zeroSumMedian * 100).toFixed(1)}% · σ ${(r.consensus.zeroSumStddev * 100).toFixed(1)}%`}
                    />
                    <Govern
                      label="Primary label agreement"
                      value={`${(r.consensus.primaryAgreement * 100).toFixed(0)}%`}
                    />
                    <Govern
                      label="Runs"
                      value={String(r.consensus.runs)}
                    />
                  </div>
                </div>
              </div>
              <div className="surface p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
                  Governance agreement across runs
                </p>
                <ul className="space-y-2">
                  {r.consensus.governanceAgreements.map((g) => (
                    <li
                      key={g.field}
                      className="surface-2 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="mono text-[var(--color-text)]">
                          {g.field}
                        </span>
                        <span
                          className="px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-full border"
                          style={{
                            borderColor:
                              g.agreement >= 0.85
                                ? "var(--color-halal-border)"
                                : g.agreement >= 0.6
                                  ? "var(--color-mushtabah-border)"
                                  : "var(--color-haram-border)",
                            color:
                              g.agreement >= 0.85
                                ? "var(--color-halal)"
                                : g.agreement >= 0.6
                                  ? "var(--color-mushtabah)"
                                  : "var(--color-haram)",
                          }}
                        >
                          {(g.agreement * 100).toFixed(0)}% agree
                        </span>
                      </div>
                      <p className="text-[var(--color-muted)] mono break-words">
                        {g.values.join(" │ ")}
                      </p>
                    </li>
                  ))}
                </ul>
                {r.consensus.warnings.length > 0 && (
                  <div
                    className="mt-5 pt-4"
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-2">
                      Consensus warnings
                    </p>
                    <ul className="space-y-1 text-xs text-[var(--color-muted)]">
                      {r.consensus.warnings.map((w, i) => (
                        <li key={i}>· {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="mt-12">
          <header className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-medium">Evidence</h2>
            <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
              {(r.documents?.length ?? 0)} document
              {(r.documents?.length ?? 0) === 1 ? "" : "s"} ·{" "}
              {state.programInteractions.length} programs
            </p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="surface p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
                Program scan ({r.evidence?.scannedTransactions ?? 0} tx,{" "}
                {r.evidence?.scannedProgramHits ?? 0} hits)
              </p>
              {state.programInteractions.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No non-noise programs observed in the recent transaction
                  window.
                </p>
              ) : (
                <ul className="space-y-2">
                  {state.programInteractions.map((p) => (
                    <li
                      key={p.program}
                      className="surface-2 p-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center text-xs"
                    >
                      <span className="mono text-[var(--color-text)] truncate">
                        {truncateMiddle(p.program, 8, 8)}
                      </span>
                      <span
                        className="px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-full"
                        style={{
                          background: kindBg(p.kind),
                          border: `1px solid ${kindBorder(p.kind)}`,
                          color: kindColor(p.kind),
                        }}
                      >
                        {p.kind}
                      </span>
                      <span className="mono num text-[var(--color-muted)]">
                        {(p.primaryRevenueShare * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="surface p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
                Documents handed to Claude
              </p>
              {!r.documents || r.documents.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No off-chain documents were ingested for this mint.
                </p>
              ) : (
                <ul className="space-y-3">
                  {r.documents.map((d, i) => (
                    <li key={i} className="surface-2 p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-full"
                          style={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-muted)",
                          }}
                        >
                          {d.kind}
                        </span>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mono text-[var(--color-text)] truncate hover:underline"
                        >
                          {d.url}
                        </a>
                      </div>
                      <p className="text-[var(--color-muted)] whitespace-pre-line break-words">
                        {d.excerpt.slice(0, 280)}
                        {d.excerpt.length > 280 ? "…" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {history.length > 1 && (
          <section className="mt-12">
            <header className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-medium">History</h2>
              <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                {history.length} screening{history.length === 1 ? "" : "s"} · {changes.length}{" "}
                change{changes.length === 1 ? "" : "s"}
              </p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="surface p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
                  Timeline · latest first
                </p>
                <ul className="space-y-2">
                  {history.map((h, idx) => (
                    <li
                      key={`${h.verdict.evidenceHash}-${idx}`}
                      className="surface-2 p-3 grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-xs"
                    >
                      <VerdictBadge verdict={h.verdict.verdict} size="sm" />
                      <span className="mono text-[var(--color-muted)] truncate">
                        {h.verdict.evidenceHash.replace("sha256:", "")
                          .slice(0, 12)}…
                      </span>
                      <span
                        className="mono num text-[var(--color-muted-2)]"
                        title={`utility ${h.verdict.scoreBreakdown.riba.toFixed(2)} riba / ${h.verdict.scoreBreakdown.sector.toFixed(2)} sector`}
                      >
                        c{h.consensus?.confidence !== undefined ? h.consensus.confidence.toFixed(2) : "—"}
                      </span>
                      <span className="text-[var(--color-muted-2)] text-right">
                        {formatRelative(h.verdict.computedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="surface p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
                  Changes detected
                </p>
                {changes.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    No verdict deltas across recorded screenings.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {changes.map((c) => (
                      <li key={c.id} className="surface-2 p-3 text-xs space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.previousVerdict && (
                            <>
                              <VerdictBadge verdict={c.previousVerdict} size="sm" />
                              <span
                                aria-hidden
                                className="text-[var(--color-muted-2)]"
                              >
                                →
                              </span>
                            </>
                          )}
                          <VerdictBadge verdict={c.newVerdict} size="sm" />
                          <span className="text-[var(--color-muted-2)] ml-auto">
                            {formatRelative(c.detectedAt)}
                          </span>
                        </div>
                        {c.diff.outcomeDeltas.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] mb-1">
                              outcome deltas
                            </p>
                            <ul className="space-y-1">
                              {c.diff.outcomeDeltas.map((d, i) => (
                                <li key={i} className="mono text-[var(--color-muted)]">
                                  {d.ruleId} :{" "}
                                  <span className="text-[var(--color-haram)]">
                                    {d.previous ?? "∅"}
                                  </span>{" "}
                                  →{" "}
                                  <span className="text-[var(--color-halal)]">
                                    {d.next}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {c.diff.scoreDeltas.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] mb-1">
                              score deltas
                            </p>
                            <ul className="space-y-1">
                              {c.diff.scoreDeltas.map((s, i) => (
                                <li key={i} className="mono text-[var(--color-muted)]">
                                  {s.axis}: {s.previous?.toFixed(2) ?? "—"} →{" "}
                                  {s.next.toFixed(2)}{" "}
                                  <span
                                    style={{
                                      color:
                                        s.delta >= 0
                                          ? "var(--color-halal)"
                                          : "var(--color-haram)",
                                    }}
                                  >
                                    ({s.delta >= 0 ? "+" : ""}
                                    {s.delta.toFixed(2)})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(c.diff.newCitations > 0 ||
                          c.diff.removedCitations > 0) && (
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                            citations: +{c.diff.newCitations} new ·{" "}
                            −{c.diff.removedCitations} removed
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

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

// Program-kind palette. Lending-interest-bearing → haram-tinted, AMM /
// marketplace / staking / governance → muted utility tone, unknown → grey.
function ConfidenceChip({ confidence, runs }: { confidence: number; runs: number }) {
  let color = "var(--color-halal)";
  let bg = "var(--color-halal-bg)";
  let border = "var(--color-halal-border)";
  let label = "high";
  if (confidence < 0.65) {
    color = "var(--color-haram)";
    bg = "var(--color-haram-bg)";
    border = "var(--color-haram-border)";
    label = "low";
  } else if (confidence < 0.85) {
    color = "var(--color-mushtabah)";
    bg = "var(--color-mushtabah-bg)";
    border = "var(--color-mushtabah-border)";
    label = "medium";
  }
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded-full font-medium"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      consensus · {label} · {confidence.toFixed(2)} ({runs}×)
    </span>
  );
}

function kindColor(kind: string): string {
  if (kind === "lending-interest-bearing") return "var(--color-haram)";
  if (kind === "amm-swap" || kind === "marketplace") return "var(--color-halal)";
  if (kind === "staking" || kind === "governance" || kind === "lending-collateral-only")
    return "var(--color-muted)";
  return "var(--color-muted-2)";
}
function kindBg(kind: string): string {
  if (kind === "lending-interest-bearing") return "var(--color-haram-bg)";
  if (kind === "amm-swap" || kind === "marketplace") return "var(--color-halal-bg)";
  return "var(--color-surface-2)";
}
function kindBorder(kind: string): string {
  if (kind === "lending-interest-bearing") return "var(--color-haram-border)";
  if (kind === "amm-swap" || kind === "marketplace")
    return "var(--color-halal-border)";
  return "var(--color-border)";
}
