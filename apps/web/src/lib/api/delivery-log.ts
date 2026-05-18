import { randomUUID } from "node:crypto";
import { sharedDb, VerdictRepository } from "@probity/storage";

export interface Delivery {
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
}

let REPO: VerdictRepository | null = null;
function repo(): VerdictRepository {
  if (!REPO) REPO = new VerdictRepository(sharedDb());
  return REPO;
}

export function record(
  partial: Omit<Delivery, "id" | "timestamp">,
): Delivery {
  const d: Delivery = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...partial,
  };
  repo().recordWebhookDelivery({
    id: d.id,
    webhookId: d.webhookId,
    event: d.event,
    url: d.url,
    timestamp: d.timestamp,
    attempt: d.attempt,
    statusCode: d.statusCode,
    latencyMs: d.latencyMs,
    success: d.success,
    ...(d.error ? { error: d.error } : {}),
  });
  return d;
}

export function listDeliveries(webhookId: string, limit = 50): Delivery[] {
  const rows = repo().listDeliveriesForWebhook(webhookId, limit);
  return rows.map((r) => ({
    id: r.id,
    webhookId: r.webhookId,
    event: r.event,
    url: r.url,
    timestamp: r.timestamp,
    attempt: r.attempt,
    statusCode: r.statusCode,
    latencyMs: r.latencyMs,
    success: r.success,
    ...(r.error ? { error: r.error } : {}),
  }));
}
