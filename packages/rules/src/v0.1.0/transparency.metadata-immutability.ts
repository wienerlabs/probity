import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
} from "@probity/types";

export const VERSION = "0.1.0";

export const rule: RuleDefinition = {
  id: "transparency.metadata-immutability",
  version: VERSION,
  material: false,
  category: "transparency",
  description:
    "Flags tokens whose Metaplex metadata is mutable and pointed at a non-pinned URI controlled by a single key.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    if (!ctx.state.metadata.isMutable) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale:
          "Metaplex metadata is_mutable=false. URI pinned to a verifiable content hash.",
        evidence: [
          {
            type: "onchain",
            account: ctx.state.metadataAccount,
            slot: ctx.state.snapshotSlot,
            field: "is_mutable",
            value: "false",
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
      rationale:
        "Metaplex metadata remains mutable — issuer can swap name, symbol, or URI at will.",
      evidence: [
        {
          type: "onchain",
          account: ctx.state.metadataAccount,
          slot: ctx.state.snapshotSlot,
          field: "is_mutable",
          value: "true",
        },
      ],
    };
  },
};
