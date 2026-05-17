// Live-only screening runtime. Every verdict in the app flows through
// this function — there is no demo / fixture short-circuit. Both
// HELIUS_API_KEY and ANTHROPIC_API_KEY must be set for screening to
// run; absence yields a typed error the API layer turns into a 503.

import { screen } from "@probity/engine";
import { HeliusClient, fetchTokenState, isLikelyBase58Pubkey } from "@probity/solana";
import { ClaudeClient, enrichTokenFromDocs } from "@probity/enrichment";
import type { ScreeningContext, VerdictRecord } from "@probity/types";
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
  enrichment_source: "claude" | "synthesised";
  warnings?: string[];
}

export interface ResolveOptions {
  /**
   * When true and we already have a recent verdict for the same
   * (mint, rule_version), return it instead of re-running the whole
   * chain. Default false — the API layer opts in.
   */
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
        enrichment_source: hit.enrichmentSource,
        warnings: ["Cached verdict from a recent live screening."],
      };
    }
  }

  const helius = new HeliusClient({ apiKey: heliusKey! });
  const state = await fetchTokenState(helius, trimmed);

  const claude = new ClaudeClient({
    apiKey: anthropicKey!,
    ...(process.env.ANTHROPIC_MODEL
      ? { model: process.env.ANTHROPIC_MODEL }
      : {}),
  });
  const enrichment = await enrichTokenFromDocs(
    { state, documents: [] },
    { client: claude },
  );

  const ctx: ScreeningContext = {
    mint: state.mint,
    ruleVersion: RULE_VERSION,
    now: new Date(),
    state,
    enrichment,
  };
  const verdict = await screen(ctx);

  pushRecent({
    verdict,
    context: ctx,
    enrichmentSource: "claude",
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
    },
  });

  return {
    mint: state.mint,
    source: "live",
    verdict,
    enrichment_source: "claude",
    warnings: [
      "Live mode: revenue model and governance shape are extracted by Claude from on-chain state alone. Pair with a named-source audit before institutional use.",
    ],
  };
}
