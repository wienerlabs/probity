import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
} from "@probity/types";

export const VERSION = "0.1.0";

const ZERO_SUM_FAIL = 0.5;
const UTILITY_FLOOR = 0.4;

export const rule: RuleDefinition = {
  id: "maysir.zero-sum-structures",
  version: VERSION,
  material: true,
  category: "maysir",
  description:
    "Fails on primary revenue from zero-sum / wagering structures. Flags when utility is unclear.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    const z = ctx.enrichment.revenueModel.zeroSumRevenueShare;
    const u = ctx.enrichment.revenueModel.utilityScore;

    if (z >= ZERO_SUM_FAIL) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "fail",
        rationale: `Primary revenue (${(z * 100).toFixed(
          1,
        )}%) sourced from zero-sum wagering or gambling structures.`,
        evidence: [
          {
            type: "derivation",
            formula: `zeroSumRevenueShare=${z.toFixed(3)} >= ${ZERO_SUM_FAIL}`,
            result: "fail",
          },
        ],
      };
    }

    if (u < UTILITY_FLOOR) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "flag",
        rationale: `Utility score ${u.toFixed(2)} is below the ${UTILITY_FLOOR.toFixed(
          2,
        )} floor — speculative narrative without identifiable utility basis.`,
        evidence: [
          {
            type: "derivation",
            formula: `utilityScore=${u.toFixed(3)} < ${UTILITY_FLOOR}`,
            result: "no_clear_utility_basis",
          },
        ],
      };
    }

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      category: this.category,
      material: this.material,
      outcome: "pass",
      rationale: `Token has an identifiable utility basis (score ${u.toFixed(
        2,
      )}); no zero-sum primary revenue.`,
      evidence: [
        {
          type: "derivation",
          formula: `utilityScore=${u.toFixed(3)} >= ${UTILITY_FLOOR} AND zeroSumRevenueShare=${z.toFixed(
            3,
          )} < ${ZERO_SUM_FAIL}`,
          result: "utility_basis_confirmed",
        },
      ],
    };
  },
};
