import type { ProgramInteraction } from "@probity/types";

// Well-known Solana program IDs. Source: Solana mainnet & each protocol's docs.
// Mappings drive the "kind" hint that feeds rule evaluation; keep this list
// conservative — over-classifying a program (e.g. tagging a stake pool as
// lending-interest-bearing) will silently push verdicts toward haram.

interface ProgramSpec {
  id: string;
  kind: ProgramInteraction["kind"];
  name: string;
}

export const PROGRAM_REGISTRY: ProgramSpec[] = [
  // AMMs / aggregators
  { id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", kind: "amm-swap", name: "Jupiter v6" },
  { id: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", kind: "amm-swap", name: "Raydium AMM v4" },
  { id: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", kind: "amm-swap", name: "Orca Whirlpools" },
  { id: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", kind: "amm-swap", name: "Raydium CLMM" },

  // Lending — interest-bearing money markets
  { id: "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo", kind: "lending-interest-bearing", name: "Solend" },
  { id: "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA", kind: "lending-interest-bearing", name: "Marginfi v2" },
  { id: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD", kind: "lending-interest-bearing", name: "Kamino Lend" },

  // Staking
  { id: "Stake11111111111111111111111111111111111111", kind: "staking", name: "Native Stake" },
  { id: "MarBmsSgKXdrN1egZf5sqe1TMThczhMLJhJTTSomTNa", kind: "staking", name: "Marinade Liquid Staking" },
  { id: "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy", kind: "staking", name: "SPL Stake Pool" },

  // Governance
  { id: "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw", kind: "governance", name: "SPL Governance" },

  // Marketplaces
  { id: "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN", kind: "marketplace", name: "Tensor Swap" },
  { id: "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K", kind: "marketplace", name: "Magic Eden v2" },
];

const BY_ID = new Map<string, ProgramSpec>(PROGRAM_REGISTRY.map((p) => [p.id, p]));

export function classifyProgram(programId: string): ProgramSpec | undefined {
  return BY_ID.get(programId);
}

export interface ClassifyInput {
  programId: string;
  // Caller-provided estimate of how much of the token's primary revenue
  // flows through this program (0..1). The ingestion layer derives this
  // from transfer fee accounting; for now callers pass it through.
  primaryRevenueShare: number;
}

export function buildProgramInteractions(
  inputs: ClassifyInput[],
): ProgramInteraction[] {
  return inputs.map((i) => {
    const spec = classifyProgram(i.programId);
    return {
      program: i.programId,
      kind: spec?.kind ?? "other",
      primaryRevenueShare: i.primaryRevenueShare,
    };
  });
}

export function listKnownPrograms(): ProgramSpec[] {
  return [...PROGRAM_REGISTRY];
}
