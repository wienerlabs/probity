import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
} from "@probity/types";

export const VERSION = "0.1.0";

const TIMELOCK_FLOOR_SECONDS = 86_400; // 24h
const MIN_THRESHOLD_M = 3;

export const rule: RuleDefinition = {
  id: "governance.proposal-transparency",
  version: VERSION,
  material: false,
  category: "governance",
  description:
    "Flags governance shapes with single-key freeze authority, missing timelock, or weak multisig thresholds.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    const g = ctx.enrichment.governance;
    const concerns: string[] = [];

    if (g.freezeAuthoritySingleKey) {
      concerns.push("freeze authority held by a single hot key");
    }
    if (g.timelockSeconds === null || g.timelockSeconds < TIMELOCK_FLOOR_SECONDS) {
      concerns.push(
        g.timelockSeconds === null
          ? "no governance timelock"
          : `timelock ${g.timelockSeconds}s below 24h floor`,
      );
    }
    if (!g.multisigThreshold || g.multisigThreshold.m < MIN_THRESHOLD_M) {
      concerns.push(
        g.multisigThreshold
          ? `multisig threshold ${g.multisigThreshold.m}-of-${g.multisigThreshold.n} below ${MIN_THRESHOLD_M}-of-n minimum`
          : "no multisig on privileged authorities",
      );
    }

    if (concerns.length === 0) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale:
          "Governance has timelock + qualified multisig on privileged authorities. No single-key freeze surface.",
        evidence: [
          {
            type: "onchain",
            account: ctx.state.mint,
            slot: ctx.state.snapshotSlot,
            field: "timelock_seconds",
            value: String(g.timelockSeconds ?? 0),
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
      rationale: `Governance concerns — ${concerns.join("; ")}.`,
      evidence: [
        {
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "freeze_authority",
          value: ctx.state.freezeAuthority ?? "null",
        },
      ],
    };
  },
};
