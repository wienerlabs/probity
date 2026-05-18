import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  id: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "init",
    up: `
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verdicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mint TEXT NOT NULL,
        rule_version TEXT NOT NULL,
        verdict TEXT NOT NULL CHECK (verdict IN ('halal','mushtabah','haram')),
        evidence_hash TEXT NOT NULL,
        computed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attestation_pubkey TEXT,
        enrichment_source TEXT NOT NULL,
        scanned_transactions INTEGER NOT NULL DEFAULT 0,
        scanned_program_hits INTEGER NOT NULL DEFAULT 0,
        known_programs INTEGER NOT NULL DEFAULT 0,
        unknown_programs INTEGER NOT NULL DEFAULT 0,
        documents_ingested INTEGER NOT NULL DEFAULT 0,
        consensus_confidence REAL,
        consensus_runs INTEGER,
        context_json TEXT NOT NULL,
        verdict_json TEXT NOT NULL,
        documents_json TEXT NOT NULL,
        consensus_json TEXT,
        warnings_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_verdicts_mint_computed
        ON verdicts(mint, computed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_verdicts_rule_version
        ON verdicts(rule_version, computed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_verdicts_verdict
        ON verdicts(verdict, computed_at DESC);

      CREATE TABLE IF NOT EXISTS verdict_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mint TEXT NOT NULL,
        previous_verdict_id INTEGER,
        new_verdict_id INTEGER NOT NULL,
        previous_verdict TEXT,
        new_verdict TEXT NOT NULL,
        diff_json TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        FOREIGN KEY (previous_verdict_id) REFERENCES verdicts(id),
        FOREIGN KEY (new_verdict_id) REFERENCES verdicts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_changes_mint_detected
        ON verdict_changes(mint, detected_at DESC);
    `,
  },
  {
    id: 2,
    name: "webhook_deliveries",
    up: `
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        event TEXT NOT NULL,
        url TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        status_code INTEGER,
        latency_ms INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_deliveries_webhook_ts
        ON webhook_deliveries(webhook_id, timestamp DESC);
    `,
  },
];

export function applyMigrations(db: DatabaseSync): { applied: number[] } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied: number[] = [];
  const existing = db
    .prepare("SELECT id FROM schema_version")
    .all() as unknown as Array<{ id: number }>;
  const set = new Set(existing.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (set.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.up);
      db.prepare("INSERT INTO schema_version (id, applied_at) VALUES (?, ?)").run(
        m.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
      applied.push(m.id);
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(
        `migration ${m.id} (${m.name}) failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return { applied };
}
