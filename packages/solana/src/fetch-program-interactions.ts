// Walks a window of recent transactions for a mint and reports every
// program that touched it, with frequency-normalised revenue-share
// proxies. Until on-chain receipts give us true revenue attribution
// this is the strongest signal we can get without manual labelling.

import type { ProgramInteraction } from "@probity/types";
import { HeliusEnhancedClient, type EnhancedTransaction } from "./helius-enhanced";
import { classifyProgram } from "./program-classifier";

// Programs that show up in literally every transaction but tell us
// nothing about the token's commercial nature.
const PROGRAM_NOISE = new Set([
  "ComputeBudget111111111111111111111111111111",
  "11111111111111111111111111111111", // System
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program (the host)
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token Account
  "Sysvar1111111111111111111111111111111111111",
  "SysvarRent111111111111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
]);

export interface FetchProgramInteractionsOptions {
  /** How many transactions to sample. Default 50. */
  sampleSize?: number;
  /** Cap on returned interactions. Default 10. */
  topK?: number;
}

export interface ProgramScanResult {
  interactions: ProgramInteraction[];
  /** Total non-noise program hits seen in the scan. */
  scannedHits: number;
  /** Total transactions read. */
  scannedTransactions: number;
  /** Programs the classifier couldn't recognise (still surfaced as "other"). */
  unknownPrograms: string[];
}

export async function fetchProgramInteractions(
  client: HeliusEnhancedClient,
  mint: string,
  opts: FetchProgramInteractionsOptions = {},
): Promise<ProgramScanResult> {
  const sampleSize = opts.sampleSize ?? 50;
  const topK = opts.topK ?? 10;

  const txs = await client.transactionsForAddress(mint, sampleSize);
  return aggregate(txs, topK);
}

// Exported for unit tests; pure function, no IO.
export function aggregate(
  txs: EnhancedTransaction[],
  topK: number,
): ProgramScanResult {
  const counts = new Map<string, number>();
  for (const t of txs) {
    if (t.transactionError) continue;
    for (const ix of t.instructions ?? []) {
      bump(counts, ix.programId);
      for (const inner of ix.innerInstructions ?? []) {
        bump(counts, inner.programId);
      }
    }
  }
  const unknown: string[] = [];
  const meaningful = [...counts.entries()].filter(
    ([id]) => !PROGRAM_NOISE.has(id),
  );
  const total = meaningful.reduce((a, [, c]) => a + c, 0);
  meaningful.sort((a, b) => b[1] - a[1]);
  const top = meaningful.slice(0, topK);

  const interactions: ProgramInteraction[] = top.map(([programId, hits]) => {
    const spec = classifyProgram(programId);
    if (!spec) unknown.push(programId);
    return {
      program: programId,
      kind: spec?.kind ?? "other",
      primaryRevenueShare: total > 0 ? hits / total : 0,
    };
  });

  return {
    interactions,
    scannedHits: total,
    scannedTransactions: txs.length,
    unknownPrograms: unknown,
  };
}

function bump(map: Map<string, number>, key: string | undefined): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}
