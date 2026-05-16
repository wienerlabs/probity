import type {
  RuleOutcome,
  ScreeningContext,
  VerdictRecord,
} from "@probity/types";
import { loadRuleSet } from "@probity/rules";
import { aggregateVerdict, computeScoreBreakdown } from "./aggregate";
import { hashEvidence } from "./hash";

const DAY = 86_400_000;
const DEFAULT_EXPIRY_MS = 30 * DAY;

export interface ScreenOptions {
  expiryMs?: number;
  attestationPubkey?: string | null;
}

export async function screen(
  ctx: ScreeningContext,
  opts: ScreenOptions = {},
): Promise<VerdictRecord> {
  const rules = loadRuleSet(ctx.ruleVersion);
  const outcomes: RuleOutcome[] = [];
  for (const rule of rules) {
    const out = await rule.evaluate(ctx);
    outcomes.push(out);
  }
  const verdict = aggregateVerdict(outcomes);
  const scoreBreakdown = computeScoreBreakdown(outcomes);
  const evidenceHash = hashEvidence(outcomes);
  const computedAt = ctx.now.toISOString();
  const expiresAt = new Date(
    ctx.now.getTime() + (opts.expiryMs ?? DEFAULT_EXPIRY_MS),
  ).toISOString();
  return {
    mint: ctx.mint,
    verdict,
    ruleVersion: ctx.ruleVersion,
    computedAt,
    expiresAt,
    evidenceHash,
    attestationPubkey: opts.attestationPubkey ?? null,
    outcomes,
    scoreBreakdown,
  };
}
