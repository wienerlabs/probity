// Runtime entry point that any API route can call. Live mode is wired
// behind HELIUS_API_KEY: when set and the requested mint isn't in the
// demo fixture set, we attempt an on-chain fetch + minimal enrichment.
// Without the key, only fixture mints resolve.

import { screen } from "@probity/engine";
import { HeliusClient, fetchTokenState, isLikelyBase58Pubkey } from "@probity/solana";
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

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new HeliusClient({ apiKey });
  try {
    const state = await fetchTokenState(client, query);
    const enrichment = synthesiseEnrichment(state);
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
      },
    });
    return {
      mint: state.mint,
      source: "live",
      verdict,
      warnings: [
        "Live mode: revenue model + governance details are inferred from on-chain state only. Verdict is provisional pending full enrichment (M2.5).",
      ],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`live fetch failed for ${query}: ${msg}`);
  }
}

// Until packages/enrichment lands, synthesise a conservative enrichment
// from the on-chain state alone. Defaults bias toward mushtabah (flag)
// rather than haram on missing data, so live verdicts are clearly marked
// as "needs human review" without false positives.
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
