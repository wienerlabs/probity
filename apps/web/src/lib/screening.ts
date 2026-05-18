import {
  VerdictRepository,
  sharedDb,
  type PersistedRow,
  type VerdictChangeRow,
  type VerdictDiff,
} from "@probity/storage";
import type { ScreeningContext, VerdictRecord } from "@probity/types";
import type { DocumentSource, ConsensusReport } from "@probity/enrichment";

let REPO: VerdictRepository | null = null;
function repo(): VerdictRepository {
  if (!REPO) REPO = new VerdictRepository(sharedDb());
  return REPO;
}

export interface RecentEntry {
  verdict: VerdictRecord;
  context: ScreeningContext;
  enrichmentSource: "claude" | "synthesised";
  documents: DocumentSource[];
  consensus?: ConsensusReport;
  evidence: {
    scannedTransactions: number;
    scannedProgramHits: number;
    knownPrograms: number;
    unknownPrograms: number;
    documentsIngested: number;
  };
  pushedAt: string;
}

export interface PushResult {
  id: number;
  changed: boolean;
  diff?: VerdictDiff;
  previousVerdict?: VerdictRecord["verdict"];
}

export function pushRecent(
  entry: Omit<RecentEntry, "pushedAt">,
): PushResult {
  const result = repo().persist({
    context: entry.context,
    verdict: entry.verdict,
    documents: entry.documents,
    warnings: [],
    evidence: entry.evidence,
    enrichmentSource: entry.enrichmentSource,
    ...(entry.consensus ? { consensus: entry.consensus } : {}),
  });
  if (result.changed && result.previousId !== null) {
    const changes = repo().changesForMint(entry.verdict.mint, 1);
    const latest = changes[0];
    if (latest) {
      return {
        id: result.id,
        changed: true,
        diff: latest.diff,
        ...(latest.previousVerdict
          ? { previousVerdict: latest.previousVerdict }
          : {}),
      };
    }
  }
  return { id: result.id, changed: result.changed };
}

function rowToRecent(r: PersistedRow): RecentEntry {
  return {
    verdict: r.verdictRecord,
    context: r.context,
    enrichmentSource: r.enrichmentSource as RecentEntry["enrichmentSource"],
    documents: r.documents as DocumentSource[],
    ...(r.consensus
      ? { consensus: r.consensus as ConsensusReport }
      : {}),
    evidence: {
      scannedTransactions: r.scannedTransactions,
      scannedProgramHits: r.scannedProgramHits,
      knownPrograms: r.knownPrograms,
      unknownPrograms: r.unknownPrograms,
      documentsIngested: r.documentsIngested,
    },
    pushedAt: r.computedAt,
  };
}

export function getRecent(limit = 20): RecentEntry[] {
  return repo().listRecent(limit).map(rowToRecent);
}

export function getRecentByMint(mint: string): RecentEntry | undefined {
  const row = repo().latestForMint(mint);
  return row ? rowToRecent(row) : undefined;
}

export function getHistory(mint: string, limit = 25): RecentEntry[] {
  return repo().historyForMint(mint, limit).map(rowToRecent);
}

export function countByVerdict() {
  return repo().countByVerdict();
}

export function getChanges(mint: string, limit = 25): VerdictChangeRow[] {
  return repo().changesForMint(mint, limit);
}

export function getRecentChanges(limit = 25): VerdictChangeRow[] {
  return repo().recentChangesAcrossMints(limit);
}

export function getStats() {
  return repo().stats();
}

export function getSectorAggregates(limit = 50) {
  return repo().aggregateSectorExposures(limit);
}

export function getProgramAggregates(limit = 50) {
  return repo().aggregateProgramInteractions(limit);
}

export function getProgramKindAggregates(limit = 50) {
  return repo().aggregateProgramKinds(limit);
}

export function getConsensusTrend(mint: string, limit = 25): number[] {
  return repo().consensusTrendForMint(mint, limit);
}

export type { VerdictDiff };
