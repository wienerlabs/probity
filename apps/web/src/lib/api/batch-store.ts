// In-memory batch screening store. Module-scoped; loses state on cold
// start. Acceptable for the dashboard demo; institutional batches must
// move to a durable queue (Inngest / Redis) before launch.

import { randomUUID } from "node:crypto";
import type { VerdictRecord } from "@probity/types";

export interface BatchItem {
  mint: string;
  status: "queued" | "running" | "done" | "error";
  verdict?: VerdictRecord;
  source?: "fixture" | "live";
  error?: string;
}

export interface Batch {
  id: string;
  owner: string;
  createdAt: string;
  status: "running" | "complete" | "partial";
  total: number;
  completed: number;
  items: BatchItem[];
}

const STORE = new Map<string, Batch>();
const MAX_BATCHES_PER_OWNER = 20;

export function createBatch(owner: string, mints: string[]): Batch {
  const batch: Batch = {
    id: randomUUID(),
    owner,
    createdAt: new Date().toISOString(),
    status: "running",
    total: mints.length,
    completed: 0,
    items: mints.map((m) => ({ mint: m, status: "queued" })),
  };
  // Drop oldest batches for this owner to bound memory.
  const mine = [...STORE.values()]
    .filter((b) => b.owner === owner)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  while (mine.length >= MAX_BATCHES_PER_OWNER) {
    const oldest = mine.shift();
    if (oldest) STORE.delete(oldest.id);
  }
  STORE.set(batch.id, batch);
  return batch;
}

export function getBatch(id: string): Batch | undefined {
  return STORE.get(id);
}

export function markItem(
  id: string,
  mint: string,
  patch: Partial<BatchItem>,
): void {
  const b = STORE.get(id);
  if (!b) return;
  const item = b.items.find((i) => i.mint === mint);
  if (!item) return;
  Object.assign(item, patch);
  b.completed = b.items.filter((i) => i.status === "done" || i.status === "error").length;
  if (b.completed === b.total) {
    b.status = b.items.some((i) => i.status === "error") ? "partial" : "complete";
  }
}
