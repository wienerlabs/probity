// Per-webhook delivery log. In-memory ring buffer (most-recent first).
// Bounded to MAX entries per webhook so we don't keep growing.

import { randomUUID } from "node:crypto";

export interface Delivery {
  id: string;
  webhookId: string;
  event: string;
  url: string;
  timestamp: string; // ISO
  attempt: number;
  statusCode: number | null;
  latencyMs: number;
  success: boolean;
  error?: string;
}

const MAX_PER_WEBHOOK = 100;
const LOG = new Map<string, Delivery[]>();

export function record(
  partial: Omit<Delivery, "id" | "timestamp">,
): Delivery {
  const d: Delivery = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...partial,
  };
  const arr = LOG.get(d.webhookId) ?? [];
  arr.unshift(d);
  while (arr.length > MAX_PER_WEBHOOK) arr.pop();
  LOG.set(d.webhookId, arr);
  return d;
}

export function listDeliveries(webhookId: string, limit = 50): Delivery[] {
  const arr = LOG.get(webhookId) ?? [];
  return arr.slice(0, limit);
}
