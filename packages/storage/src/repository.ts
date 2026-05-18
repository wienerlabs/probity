import type { DatabaseSync } from "node:sqlite";
import type {
  ScreeningContext,
  VerdictRecord,
} from "@probity/types";

export interface PersistInput {
  context: ScreeningContext;
  verdict: VerdictRecord;
  documents: unknown[];
  consensus?: unknown;
  warnings?: string[];
  evidence: {
    scannedTransactions: number;
    scannedProgramHits: number;
    knownPrograms: number;
    unknownPrograms: number;
    documentsIngested: number;
  };
  enrichmentSource: string;
}

export interface PersistedRow {
  id: number;
  mint: string;
  ruleVersion: string;
  verdict: VerdictRecord["verdict"];
  evidenceHash: string;
  computedAt: string;
  expiresAt: string;
  attestationPubkey: string | null;
  enrichmentSource: string;
  scannedTransactions: number;
  scannedProgramHits: number;
  knownPrograms: number;
  unknownPrograms: number;
  documentsIngested: number;
  consensusConfidence: number | null;
  consensusRuns: number | null;
  context: ScreeningContext;
  verdictRecord: VerdictRecord;
  documents: unknown[];
  consensus: unknown | null;
  warnings: string[];
}

export interface PersistResult {
  id: number;
  previousId: number | null;
  changed: boolean;
}

export interface VerdictChangeRow {
  id: number;
  mint: string;
  previousVerdictId: number | null;
  newVerdictId: number;
  previousVerdict: VerdictRecord["verdict"] | null;
  newVerdict: VerdictRecord["verdict"];
  diff: VerdictDiff;
  detectedAt: string;
}

export interface VerdictDiff {
  verdictChanged: boolean;
  previous: VerdictRecord["verdict"] | null;
  next: VerdictRecord["verdict"];
  outcomeDeltas: Array<{
    ruleId: string;
    previous: string | null;
    next: string;
  }>;
  scoreDeltas: Array<{
    axis: string;
    previous: number | null;
    next: number;
    delta: number;
  }>;
  newCitations: number;
  removedCitations: number;
}

const INSERT_SQL = `
  INSERT INTO verdicts (
    mint, rule_version, verdict, evidence_hash, computed_at, expires_at,
    attestation_pubkey, enrichment_source,
    scanned_transactions, scanned_program_hits, known_programs,
    unknown_programs, documents_ingested,
    consensus_confidence, consensus_runs,
    context_json, verdict_json, documents_json, consensus_json,
    warnings_json
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?, ?
  )
`;

const INSERT_CHANGE_SQL = `
  INSERT INTO verdict_changes (
    mint, previous_verdict_id, new_verdict_id,
    previous_verdict, new_verdict, diff_json, detected_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export class VerdictRepository {
  constructor(private readonly db: DatabaseSync) {}

  persist(input: PersistInput): PersistResult {
    const previous = this.latestForMint(input.context.mint);
    const consensusConfidence = extractConsensusConfidence(input.consensus);
    const consensusRuns = extractConsensusRuns(input.consensus);

    const stmt = this.db.prepare(INSERT_SQL);
    const info = stmt.run(
      input.context.mint,
      input.verdict.ruleVersion,
      input.verdict.verdict,
      input.verdict.evidenceHash,
      input.verdict.computedAt,
      input.verdict.expiresAt,
      input.verdict.attestationPubkey ?? null,
      input.enrichmentSource,
      input.evidence.scannedTransactions,
      input.evidence.scannedProgramHits,
      input.evidence.knownPrograms,
      input.evidence.unknownPrograms,
      input.evidence.documentsIngested,
      consensusConfidence,
      consensusRuns,
      JSON.stringify(input.context),
      JSON.stringify(input.verdict),
      JSON.stringify(input.documents ?? []),
      input.consensus ? JSON.stringify(input.consensus) : null,
      JSON.stringify(input.warnings ?? []),
    );
    const newId = Number(info.lastInsertRowid);

    let changed = false;
    if (previous) {
      const diff = computeDiff(previous.verdictRecord, input.verdict);
      changed = diff.verdictChanged || diff.outcomeDeltas.length > 0;
      if (changed) {
        this.db
          .prepare(INSERT_CHANGE_SQL)
          .run(
            input.context.mint,
            previous.id,
            newId,
            previous.verdict,
            input.verdict.verdict,
            JSON.stringify(diff),
            new Date().toISOString(),
          );
      }
    } else {
      changed = true;
    }

    return {
      id: newId,
      previousId: previous?.id ?? null,
      changed,
    };
  }

  latestForMint(mint: string): PersistedRow | null {
    const row = this.db
      .prepare(
        "SELECT * FROM verdicts WHERE mint = ? ORDER BY computed_at DESC LIMIT 1",
      )
      .get(mint) as unknown as RawRow | undefined;
    return row ? hydrate(row) : null;
  }

  historyForMint(mint: string, limit = 25): PersistedRow[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM verdicts WHERE mint = ? ORDER BY computed_at DESC LIMIT ?",
      )
      .all(mint, limit) as unknown as RawRow[];
    return rows.map(hydrate);
  }

  listRecent(limit = 20): PersistedRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM verdicts
         WHERE id IN (
           SELECT MAX(id) FROM verdicts GROUP BY mint
         )
         ORDER BY computed_at DESC LIMIT ?`,
      )
      .all(limit) as unknown as RawRow[];
    return rows.map(hydrate);
  }

  countByVerdict(): Record<VerdictRecord["verdict"], number> {
    const rows = this.db
      .prepare(
        `SELECT verdict, COUNT(*) AS n FROM (
           SELECT verdict FROM verdicts v1
           WHERE id IN (SELECT MAX(id) FROM verdicts GROUP BY mint)
         ) GROUP BY verdict`,
      )
      .all() as unknown as Array<{ verdict: VerdictRecord["verdict"]; n: number }>;
    const out: Record<VerdictRecord["verdict"], number> = {
      halal: 0,
      mushtabah: 0,
      haram: 0,
    };
    for (const r of rows) out[r.verdict] = Number(r.n);
    return out;
  }

  changesForMint(mint: string, limit = 25): VerdictChangeRow[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM verdict_changes WHERE mint = ? ORDER BY detected_at DESC LIMIT ?",
      )
      .all(mint, limit) as unknown as Array<{
      id: number;
      mint: string;
      previous_verdict_id: number | null;
      new_verdict_id: number;
      previous_verdict: VerdictRecord["verdict"] | null;
      new_verdict: VerdictRecord["verdict"];
      diff_json: string;
      detected_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      mint: r.mint,
      previousVerdictId: r.previous_verdict_id,
      newVerdictId: r.new_verdict_id,
      previousVerdict: r.previous_verdict,
      newVerdict: r.new_verdict,
      diff: JSON.parse(r.diff_json) as VerdictDiff,
      detectedAt: r.detected_at,
    }));
  }

  recordWebhookDelivery(d: {
    id: string;
    webhookId: string;
    event: string;
    url: string;
    timestamp: string;
    attempt: number;
    statusCode: number | null;
    latencyMs: number;
    success: boolean;
    error?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO webhook_deliveries
         (id, webhook_id, event, url, timestamp, attempt, status_code, latency_ms, success, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.id,
        d.webhookId,
        d.event,
        d.url,
        d.timestamp,
        d.attempt,
        d.statusCode,
        d.latencyMs,
        d.success ? 1 : 0,
        d.error ?? null,
      );
  }

  listDeliveriesForWebhook(webhookId: string, limit = 50) {
    const rows = this.db
      .prepare(
        `SELECT * FROM webhook_deliveries WHERE webhook_id = ?
         ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(webhookId, limit) as unknown as Array<{
      id: string;
      webhook_id: string;
      event: string;
      url: string;
      timestamp: string;
      attempt: number;
      status_code: number | null;
      latency_ms: number;
      success: number;
      error: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      webhookId: r.webhook_id,
      event: r.event,
      url: r.url,
      timestamp: r.timestamp,
      attempt: r.attempt,
      statusCode: r.status_code,
      latencyMs: r.latency_ms,
      success: r.success === 1,
      error: r.error,
    }));
  }
}

interface RawRow {
  id: number;
  mint: string;
  rule_version: string;
  verdict: VerdictRecord["verdict"];
  evidence_hash: string;
  computed_at: string;
  expires_at: string;
  attestation_pubkey: string | null;
  enrichment_source: string;
  scanned_transactions: number;
  scanned_program_hits: number;
  known_programs: number;
  unknown_programs: number;
  documents_ingested: number;
  consensus_confidence: number | null;
  consensus_runs: number | null;
  context_json: string;
  verdict_json: string;
  documents_json: string;
  consensus_json: string | null;
  warnings_json: string;
}

function hydrate(row: RawRow): PersistedRow {
  return {
    id: row.id,
    mint: row.mint,
    ruleVersion: row.rule_version,
    verdict: row.verdict,
    evidenceHash: row.evidence_hash,
    computedAt: row.computed_at,
    expiresAt: row.expires_at,
    attestationPubkey: row.attestation_pubkey,
    enrichmentSource: row.enrichment_source,
    scannedTransactions: row.scanned_transactions,
    scannedProgramHits: row.scanned_program_hits,
    knownPrograms: row.known_programs,
    unknownPrograms: row.unknown_programs,
    documentsIngested: row.documents_ingested,
    consensusConfidence: row.consensus_confidence,
    consensusRuns: row.consensus_runs,
    context: JSON.parse(row.context_json) as ScreeningContext,
    verdictRecord: JSON.parse(row.verdict_json) as VerdictRecord,
    documents: JSON.parse(row.documents_json) as unknown[],
    consensus: row.consensus_json ? JSON.parse(row.consensus_json) : null,
    warnings: JSON.parse(row.warnings_json) as string[],
  };
}

export function computeDiff(
  previous: VerdictRecord,
  next: VerdictRecord,
): VerdictDiff {
  const verdictChanged = previous.verdict !== next.verdict;
  const outcomeDeltas: VerdictDiff["outcomeDeltas"] = [];
  const prevByRule = new Map(previous.outcomes.map((o) => [o.ruleId, o.outcome]));
  for (const o of next.outcomes) {
    const prev = prevByRule.get(o.ruleId);
    if (prev === undefined) {
      outcomeDeltas.push({ ruleId: o.ruleId, previous: null, next: o.outcome });
    } else if (prev !== o.outcome) {
      outcomeDeltas.push({ ruleId: o.ruleId, previous: prev, next: o.outcome });
    }
  }
  for (const [ruleId, prev] of prevByRule.entries()) {
    if (!next.outcomes.find((o) => o.ruleId === ruleId)) {
      outcomeDeltas.push({ ruleId, previous: prev, next: "removed" });
    }
  }

  const scoreDeltas: VerdictDiff["scoreDeltas"] = [];
  for (const axis of Object.keys(next.scoreBreakdown) as Array<
    keyof VerdictRecord["scoreBreakdown"]
  >) {
    const p = previous.scoreBreakdown[axis] ?? null;
    const n = next.scoreBreakdown[axis];
    const delta = p === null ? n : n - p;
    if (p === null || Math.abs(delta) > 0.01) {
      scoreDeltas.push({ axis, previous: p, next: n, delta });
    }
  }

  const prevHashes = new Set(
    previous.outcomes.flatMap((o) => o.evidence.map((e) => citationKey(e))),
  );
  const nextHashes = new Set(
    next.outcomes.flatMap((o) => o.evidence.map((e) => citationKey(e))),
  );
  let added = 0;
  let removed = 0;
  for (const h of nextHashes) if (!prevHashes.has(h)) added++;
  for (const h of prevHashes) if (!nextHashes.has(h)) removed++;

  return {
    verdictChanged,
    previous: previous.verdict,
    next: next.verdict,
    outcomeDeltas,
    scoreDeltas,
    newCitations: added,
    removedCitations: removed,
  };
}

function citationKey(c: VerdictRecord["outcomes"][number]["evidence"][number]): string {
  if (c.type === "onchain") return `o::${c.account}::${c.field}::${c.value}`;
  if (c.type === "document") return `d::${c.sourceUrl}::${c.contentHash}`;
  return `r::${c.formula}::${c.result}`;
}

function extractConsensusConfidence(consensus: unknown): number | null {
  if (consensus && typeof consensus === "object" && "confidence" in consensus) {
    const c = (consensus as { confidence?: unknown }).confidence;
    return typeof c === "number" ? c : null;
  }
  return null;
}

function extractConsensusRuns(consensus: unknown): number | null {
  if (consensus && typeof consensus === "object" && "runs" in consensus) {
    const r = (consensus as { runs?: unknown }).runs;
    return typeof r === "number" ? r : null;
  }
  return null;
}
