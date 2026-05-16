import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
  SectorTag,
} from "@probity/types";

export const VERSION = "0.1.0";

const HARAM_SECTORS: SectorTag[] = [
  "alcohol",
  "gambling",
  "adult",
  "tobacco",
  "weapons",
  "conventional-finance",
  "pork",
  "lending-interest",
];

const MATERIAL_THRESHOLD = 0.05;

export const rule: RuleDefinition = {
  id: "haram-sector.exposure",
  version: VERSION,
  material: true,
  category: "haram-sector",
  description:
    "Fails if material revenue exposure (>5%) to alcohol, gambling, adult content, tobacco, weapons, conventional finance, pork, or interest-based lending.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    const haramExposures = ctx.enrichment.revenueModel.exposures.filter((e) =>
      HARAM_SECTORS.includes(e.tag),
    );
    const totalShare = haramExposures.reduce((a, e) => a + e.revenueShare, 0);

    if (haramExposures.length === 0) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale:
          "Issuer revenue derived from on-chain swap fees, marketplace fees, or utility services; no exposure to haram sectors.",
        evidence: ctx.enrichment.audits.slice(0, 1),
      };
    }

    if (totalShare >= MATERIAL_THRESHOLD) {
      const top = haramExposures.reduce((a, b) =>
        a.revenueShare > b.revenueShare ? a : b,
      );
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "fail",
        rationale: `Material exposure to haram sector "${top.tag}" at ${(
          top.revenueShare * 100
        ).toFixed(1)}% of revenue.`,
        evidence: [
          top.source,
          {
            type: "derivation",
            formula: `sum(revenueShare in haramSectors) = ${totalShare.toFixed(
              3,
            )} >= ${MATERIAL_THRESHOLD}`,
            result: "fail",
          },
        ],
      };
    }

    const top = haramExposures.reduce((a, b) =>
      a.revenueShare > b.revenueShare ? a : b,
    );
    return {
      ruleId: this.id,
      ruleVersion: this.version,
      category: this.category,
      material: this.material,
      outcome: "flag",
      rationale: `Adjacent exposure to "${top.tag}" at ${(
        top.revenueShare * 100
      ).toFixed(1)}% — below the ${(MATERIAL_THRESHOLD * 100).toFixed(
        0,
      )}% material threshold. Pending human review.`,
      evidence: [top.source],
    };
  },
};
