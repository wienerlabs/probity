// Live-only screening runtime. Three real-evidence stages compose the
// ScreeningContext before the engine runs:
//
//   1. Chain ingest        — Helius RPC + DAS getAsset → SolanaTokenState
//                            (mint authority, freeze, supply, metadata).
//   2. Program scan        — Helius enhanced transactions API → the
//                            actual programs touching this mint over
//                            the last N transactions. This is what
//                            makes the riba rule non-trivial.
//   3. Doc fetch + Claude  — Metaplex metadata JSON + external_url
//                            HTML are fetched (size + timeout capped)
//                            and handed to Claude as evidence. Claude
//                            extracts the RevenueModel + GovernanceShape
//                            under a strict prompt and tight validator.
//
// Each stage's failure mode is non-fatal but warning-emitting: a
// failure in stage 2 simply leaves programInteractions empty (riba
// rule still pass-by-default but warning is surfaced); a failure in
// stage 3 is the only stage we hard-fail on, because a screening with
// no enrichment is not a screening at all.

import { screen } from "@probity/engine";
import {
  HeliusClient,
  HeliusEnhancedClient,
  fetchProgramInteractions,
  fetchTokenState,
  isLikelyBase58Pubkey,
} from "@probity/solana";
import {
  ClaudeClient,
  enrichTokenFromDocs,
  enrichWithConsensus,
  fetchTokenDocuments,
} from "@probity/enrichment";
import type { ScreeningContext, VerdictRecord } from "@probity/types";
import type { ConsensusReport, DocumentSource } from "@probity/enrichment";
import { getRecentByMint, pushRecent } from "@/lib/screening";
import { emit } from "./events";

const RULE_VERSION = "0.1.0";

export class ScreeningConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`missing required env: ${missing.join(", ")}`);
    this.name = "ScreeningConfigError";
  }
}

export class InvalidMintError extends Error {
  constructor(query: string) {
    super(`"${query}" is not a base58 Solana mint address`);
    this.name = "InvalidMintError";
  }
}

export interface ResolvedVerdict {
  mint: string;
  source: "live";
  verdict: VerdictRecord;
  enrichment_source: "claude";
  warnings?: string[];
  /** Diagnostic counters so the UI can show what real evidence backed the call. */
  evidence?: {
    scannedTransactions: number;
    scannedProgramHits: number;
    knownPrograms: number;
    unknownPrograms: number;
    documentsIngested: number;
  };
  /** The actual document set Claude was handed. UI surfaces them as a citation list. */
  documents?: DocumentSource[];
  /** Cross-run consensus report when 3x enrichment was run. */
  consensus?: ConsensusReport;
}

export interface ResolveOptions {
  useRecentCache?: boolean;
}

export async function resolveVerdict(
  query: string,
  opts: ResolveOptions = {},
): Promise<ResolvedVerdict> {
  const trimmed = query.trim();
  if (!isLikelyBase58Pubkey(trimmed)) {
    throw new InvalidMintError(trimmed);
  }

  const missing: string[] = [];
  const heliusKey = process.env.HELIUS_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!heliusKey) missing.push("HELIUS_API_KEY");
  if (!anthropicKey) missing.push("ANTHROPIC_API_KEY");
  if (missing.length > 0) throw new ScreeningConfigError(missing);

  if (opts.useRecentCache) {
    const hit = getRecentByMint(trimmed);
    if (hit) {
      return {
        mint: hit.verdict.mint,
        source: "live",
        verdict: hit.verdict,
        enrichment_source: hit.enrichmentSource as "claude",
        warnings: ["Cached verdict from a recent live screening."],
        evidence: hit.evidence,
        documents: hit.documents,
      };
    }
  }

  const warnings: string[] = [];

  // ---- Stage 1: chain state ----
  const helius = new HeliusClient({ apiKey: heliusKey! });
  const state = await fetchTokenState(helius, trimmed);

  // ---- Stage 2 + Stage 3a (parallel): program scan + doc fetch ----
  const enhanced = new HeliusEnhancedClient({ apiKey: heliusKey! });
  const [scanResult, docsResult] = await Promise.all([
    fetchProgramInteractions(enhanced, trimmed, { sampleSize: 50 }).catch(
      (e) => {
        warnings.push(
          `Program scan failed (${formatErr(e)}); riba rule will run against an empty interaction set.`,
        );
        return {
          interactions: [],
          scannedHits: 0,
          scannedTransactions: 0,
          unknownPrograms: [],
        };
      },
    ),
    fetchTokenDocuments(state, {
      ...(process.env.BIRDEYE_API_KEY
        ? { birdeyeApiKey: process.env.BIRDEYE_API_KEY }
        : {}),
      ...(process.env.COINGECKO_API_KEY
        ? { coingeckoApiKey: process.env.COINGECKO_API_KEY }
        : {}),
    }).catch((e) => {
      warnings.push(`Doc fetch failed (${formatErr(e)}); enrichment will run on chain state alone.`);
      return { documents: [], warnings: [] };
    }),
  ]);

  // Merge program scan into state so the engine evaluates against real
  // observed interactions, not the empty placeholder.
  state.programInteractions = scanResult.interactions;
  warnings.push(...docsResult.warnings);

  // ---- Stage 3b: Claude enrichment with 3-run consensus ----
  const claude = new ClaudeClient({
    apiKey: anthropicKey!,
    ...(process.env.ANTHROPIC_MODEL
      ? { model: process.env.ANTHROPIC_MODEL }
      : {}),
  });
  const runsEnv = Number(process.env.PROBITY_ENRICHMENT_RUNS ?? "3");
  const runs = Math.max(1, Math.min(5, Number.isFinite(runsEnv) ? runsEnv : 3));
  let enrichment;
  let consensus: ConsensusReport | undefined;
  if (runs === 1) {
    enrichment = await enrichTokenFromDocs(
      { state, documents: docsResult.documents },
      { client: claude },
    );
  } else {
    const result = await enrichWithConsensus(
      { state, documents: docsResult.documents },
      { client: claude, runs },
    );
    enrichment = result.bundle;
    consensus = result.report;
    if (consensus.confidence < 0.7) {
      warnings.push(
        `Low cross-run confidence ${consensus.confidence.toFixed(2)}; verdict carries higher uncertainty than usual.`,
      );
    }
    if (consensus.warnings.length > 0) {
      warnings.push(...consensus.warnings);
    }
  }

  // ---- Stage 4: deterministic engine ----
  const ctx: ScreeningContext = {
    mint: state.mint,
    ruleVersion: RULE_VERSION,
    now: new Date(),
    state,
    enrichment,
  };
  const verdict = await screen(ctx);

  const evidence = {
    scannedTransactions: scanResult.scannedTransactions,
    scannedProgramHits: scanResult.scannedHits,
    knownPrograms: scanResult.interactions.filter((i) => i.kind !== "other").length,
    unknownPrograms: scanResult.unknownPrograms.length,
    documentsIngested: docsResult.documents.length,
  };

  const push = pushRecent({
    verdict,
    context: ctx,
    enrichmentSource: "claude",
    documents: docsResult.documents,
    evidence,
    ...(consensus ? { consensus } : {}),
  });

  emit({
    event: "verdict.computed",
    data: {
      mint: state.mint,
      verdict: verdict.verdict,
      rule_version: verdict.ruleVersion,
      evidence_hash: verdict.evidenceHash,
      source: "live",
      enrichment_source: "claude",
      scanned_transactions: scanResult.scannedTransactions,
      documents_ingested: docsResult.documents.length,
      ...(consensus ? { consensus_confidence: consensus.confidence } : {}),
    },
  });

  if (push.changed && push.diff && push.previousVerdict) {
    emit({
      event: "verdict.changed",
      data: {
        mint: state.mint,
        previous_verdict: push.previousVerdict,
        next_verdict: verdict.verdict,
        rule_version: verdict.ruleVersion,
        evidence_hash: verdict.evidenceHash,
        outcome_deltas: push.diff.outcomeDeltas,
        score_deltas: push.diff.scoreDeltas,
        new_citations: push.diff.newCitations,
        removed_citations: push.diff.removedCitations,
      },
    });
    warnings.push(
      `Verdict moved from ${push.previousVerdict} to ${verdict.verdict} since the last screening.`,
    );
  }

  return {
    mint: state.mint,
    source: "live",
    verdict,
    enrichment_source: "claude",
    warnings: [
      `Screened ${evidence.scannedTransactions} recent transactions and ${evidence.documentsIngested} off-chain document${evidence.documentsIngested === 1 ? "" : "s"}${consensus ? ` across ${consensus.runs} consensus runs (confidence ${consensus.confidence.toFixed(2)})` : ""}.`,
      ...warnings,
    ],
    evidence,
    documents: docsResult.documents,
    ...(consensus ? { consensus } : {}),
  };
}

function formatErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
