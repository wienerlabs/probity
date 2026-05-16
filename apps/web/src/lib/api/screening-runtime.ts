// Runtime entry point that any API route can call. Live mode unfolds in
// two stages, each gated on an environment variable:
//   1. HELIUS_API_KEY  → pull SolanaTokenState on-chain.
//   2. ANTHROPIC_API_KEY → upgrade enrichment by asking Claude to extract
//      a RevenueModel + GovernanceShape from supplied documents (or from
//      the chain state alone when no docs are supplied).
// If either is missing, we degrade gracefully: HELIUS off → fixture-only,
// HELIUS on + ANTHROPIC off → synthesised enrichment (legacy path).

import { screen } from "@probity/engine";
import { HeliusClient, fetchTokenState, isLikelyBase58Pubkey } from "@probity/solana";
import { ClaudeClient, enrichTokenFromDocs } from "@probity/enrichment";
import type { EnrichmentBundle, ScreeningContext, VerdictRecord } from "@probity/types";
import { findRecord } from "@/lib/screening";
import { emit } from "./events";

const RULE_VERSION = "0.1.0";

export interface ResolvedVerdict {
  mint: string;
  source: "fixture" | "live";
  verdict: VerdictRecord;
  // For fixture-source records we surface chart series too; live records omit.
  priceSeries?: { time: number; open: number; high: number; low: number; close: number }[];
  holderSeries?: { time: number; value: number }[];
  warnings?: string[];
  enrichment_source?: "claude" | "synthesised";
}

export async function resolveVerdict(query: string): Promise<ResolvedVerdict | null> {
  const fixture = findRecord(query);
  if (fixture) {
    emit({
      event: "verdict.computed",
      data: {
        mint: fixture.verdict.mint,
        verdict: fixture.verdict.verdict,
        rule_version: fixture.verdict.ruleVersion,
        evidence_hash: fixture.verdict.evidenceHash,
        source: "fixture",
      },
    });
    return {
      mint: fixture.verdict.mint,
      source: "fixture",
      verdict: fixture.verdict,
      priceSeries: fixture.priceSeries,
      holderSeries: fixture.holderSeries,
    };
  }

  if (!isLikelyBase58Pubkey(query)) {
    return null;
  }

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) {
    return null;
  }

  const client = new HeliusClient({ apiKey: heliusKey });
  const warnings: string[] = [];
  let enrichmentSource: "claude" | "synthesised" = "synthesised";

  try {
    const state = await fetchTokenState(client, query);

    let enrichment: EnrichmentBundle;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const claude = new ClaudeClient({
          apiKey: anthropicKey,
          ...(process.env.ANTHROPIC_MODEL
            ? { model: process.env.ANTHROPIC_MODEL }
            : {}),
        });
        enrichment = await enrichTokenFromDocs(
          { state, documents: [] },
          { client: claude },
        );
        enrichmentSource = "claude";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(
          `Claude enrichment failed (${msg}); fell back to synthesised model.`,
        );
        enrichment = synthesiseEnrichment(state);
      }
    } else {
      enrichment = synthesiseEnrichment(state);
      warnings.push(
        "ANTHROPIC_API_KEY not set; enrichment is synthesised from on-chain state only.",
      );
    }

    const ctx: ScreeningContext = {
      mint: state.mint,
      ruleVersion: RULE_VERSION,
      now: new Date(),
      state,
      enrichment,
    };
    const verdict = await screen(ctx);

    emit({
      event: "verdict.computed",
      data: {
        mint: state.mint,
        verdict: verdict.verdict,
        rule_version: verdict.ruleVersion,
        evidence_hash: verdict.evidenceHash,
        source: "live",
        enrichment_source: enrichmentSource,
      },
    });

    return {
      mint: state.mint,
      source: "live",
      verdict,
      warnings: [
        "Live mode: enrichment is best-effort; verdict is provisional pending named-source audit corroboration.",
        ...warnings,
      ],
      enrichment_source: enrichmentSource,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`live fetch failed for ${query}: ${msg}`);
  }
}

// Conservative fallback when ANTHROPIC_API_KEY is absent — derives only
// from on-chain state. Biases toward flag/mushtabah on missing data so
// live verdicts are marked "needs human review" without false-positive
// fails.
function synthesiseEnrichment(state: {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  programInteractions: { kind: string; primaryRevenueShare: number }[];
}): EnrichmentBundle {
  const interestShare = state.programInteractions
    .filter((p) => p.kind === "lending-interest-bearing")
    .reduce((a, p) => a + p.primaryRevenueShare, 0);

  return {
    audits: [],
    revenueModel: {
      primary: "unknown-pending-enrichment",
      exposures:
        interestShare > 0
          ? [
              {
                tag: "lending-interest",
                revenueShare: interestShare,
                source: {
                  type: "derivation",
                  formula: `sum(primaryRevenueShare where kind=lending-interest-bearing) = ${interestShare.toFixed(
                    3,
                  )}`,
                  result: "inferred_from_program_interactions",
                },
              },
            ]
          : [],
      zeroSumRevenueShare: 0,
      // Below the maysir utility-floor by default — engine will flag
      // (not fail) unless enrichment overrides.
      utilityScore: 0.35,
    },
    governance: {
      timelockSeconds: null,
      multisigThreshold: null,
      freezeAuthoritySingleKey: state.freezeAuthority !== null,
    },
  };
}
