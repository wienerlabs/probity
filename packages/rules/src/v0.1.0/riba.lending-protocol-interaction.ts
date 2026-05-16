import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
} from "@probity/types";

export const VERSION = "0.1.0";

const INTEREST_BEARING_REVENUE_SHARE_THRESHOLD = 0.05;

export const rule: RuleDefinition = {
  id: "riba.lending-protocol-interaction",
  version: VERSION,
  material: true,
  category: "riba",
  description:
    "Fails if a material share of the token's revenue derives from interest-bearing lending program interactions.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    const interactions = ctx.state.programInteractions.filter(
      (p) => p.kind === "lending-interest-bearing",
    );
    const interestShare = interactions.reduce(
      (acc, p) => acc + p.primaryRevenueShare,
      0,
    );

    if (interactions.length === 0) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale:
          "No interactions with conventional interest-bearing lending programs observed.",
        evidence: [
          {
            type: "onchain",
            account: ctx.state.mint,
            slot: ctx.state.snapshotSlot,
            field: "program_interactions",
            value: "no_interest_bearing_program_calls_observed",
          },
        ],
      };
    }

    if (interestShare >= INTEREST_BEARING_REVENUE_SHARE_THRESHOLD) {
      const top = interactions.reduce((a, b) =>
        a.primaryRevenueShare > b.primaryRevenueShare ? a : b,
      );
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "fail",
        rationale: `Primary revenue derives from an interest-bearing lending pool (${(
          interestShare * 100
        ).toFixed(1)}% of revenue). Direct riba violation.`,
        evidence: [
          {
            type: "onchain",
            account: top.program,
            slot: ctx.state.snapshotSlot,
            field: "program_interactions",
            value: `primary_revenue_via_interest_lending_pool=${top.primaryRevenueShare}`,
          },
          {
            type: "derivation",
            formula: `sum(primaryRevenueShare where kind=lending-interest-bearing) = ${interestShare.toFixed(
              3,
            )} >= ${INTEREST_BEARING_REVENUE_SHARE_THRESHOLD}`,
            result: "fail",
          },
        ],
      };
    }

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      category: this.category,
      material: this.material,
      outcome: "flag",
      rationale: `Interest-bearing lending interaction observed at ${(
        interestShare * 100
      ).toFixed(1)}% of revenue — below the ${(
        INTEREST_BEARING_REVENUE_SHARE_THRESHOLD * 100
      ).toFixed(0)}% material threshold. Flagged for review.`,
      evidence: [
        {
          type: "derivation",
          formula: `interestShare=${interestShare.toFixed(3)} < ${INTEREST_BEARING_REVENUE_SHARE_THRESHOLD}`,
          result: "flag",
        },
      ],
    };
  },
};
