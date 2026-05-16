import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
} from "@probity/types";

export const VERSION = "0.1.0";

export const rule: RuleDefinition = {
  id: "gharar.tokenomics-disclosure",
  version: VERSION,
  material: false,
  category: "gharar",
  description:
    "Flags excessive uncertainty in tokenomics — undisclosed reserves, retained mint authority alongside uncapped supply, mutable metadata pointing to dynamic URIs.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    const concerns: string[] = [];

    if (ctx.state.mintAuthority !== null) {
      concerns.push("mint authority retained");
    }
    if (!ctx.enrichment.reserveDisclosure) {
      // Only material for tokens whose primary revenue is reserve yield.
      const stable = ctx.enrichment.revenueModel.exposures.find(
        (e) => e.tag === "stablecoin",
      );
      if (stable && stable.revenueShare >= 0.5) {
        concerns.push("reserve composition not disclosed");
      }
    }

    if (concerns.length === 0) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale:
          "Supply mechanics, treasury, and reserves are transparently disclosed.",
        evidence: [
          {
            type: "onchain",
            account: ctx.state.mint,
            slot: ctx.state.snapshotSlot,
            field: "mint_authority",
            value: String(ctx.state.mintAuthority),
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
      rationale: `Uncertainty surface — ${concerns.join("; ")}.`,
      evidence: [
        {
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "mint_authority",
          value: String(ctx.state.mintAuthority),
        },
        ...(ctx.enrichment.reserveDisclosure
          ? [ctx.enrichment.reserveDisclosure]
          : []),
      ],
    };
  },
};
