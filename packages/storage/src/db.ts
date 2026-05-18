import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { applyMigrations } from "./migrations";

export interface OpenDbOptions {
  path?: string;
  readonly?: boolean;
}

export function openDb(opts: OpenDbOptions = {}): DatabaseSync {
  const path = opts.path ?? resolve(process.cwd(), "data", "probity.db");
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path, { readOnly: opts.readonly ?? false });
  if (!opts.readonly) {
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA foreign_keys = ON");
    applyMigrations(db);
  }
  return db;
}

let SHARED: DatabaseSync | null = null;

export function sharedDb(): DatabaseSync {
  if (SHARED) return SHARED;
  SHARED = openDb();
  return SHARED;
}

export function closeShared(): void {
  if (SHARED) {
    SHARED.close();
    SHARED = null;
  }
}
