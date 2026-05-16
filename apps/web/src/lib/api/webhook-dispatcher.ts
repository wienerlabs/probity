// Webhook dispatcher. Signs each payload with HMAC-SHA-256 over a
// canonicalised body and a unix-second timestamp, posts with a short
// timeout, retries on transient failure (network error or 5xx) with
// exponential backoff. Successful 2xx OR explicit 4xx (the caller
// rejected the payload) both stop the retry loop — 4xx is "delivered",
// just not accepted.

import { createHmac } from "node:crypto";
import { record } from "./delivery-log";
import type { Webhook, WebhookEvent } from "./webhook-store";

const REQUEST_TIMEOUT_MS = 5_000;
const BACKOFF_MS = [0, 1_000, 4_000, 16_000];

export interface EventPayload {
  event: WebhookEvent;
  data: Record<string, unknown>;
}

interface DispatchResult {
  attempts: number;
  finalStatus: number | null;
  success: boolean;
  error?: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function signPayload(
  secretHex: string,
  body: string,
  timestamp: number,
): string {
  const key = Buffer.from(secretHex, "hex");
  const h = createHmac("sha256", key);
  h.update(`${timestamp}.${body}`);
  return h.digest("hex");
}

async function postOnce(
  webhook: Webhook,
  body: string,
  timestamp: number,
  attempt: number,
  event: WebhookEvent,
): Promise<{ status: number | null; success: boolean; error?: string; latencyMs: number }> {
  const sig = signPayload(webhook.secret, body, timestamp);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Probity-Webhook/1.0",
        "x-probity-event": event,
        "x-probity-timestamp": String(timestamp),
        "x-probity-signature": `t=${timestamp},v1=${sig}`,
        "x-probity-attempt": String(attempt),
      },
      body,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    // 2xx and 4xx both count as "received" — only 5xx + network errors retry.
    if (res.status >= 500) {
      return { status: res.status, success: false, latencyMs, error: `http ${res.status}` };
    }
    return { status: res.status, success: res.status < 300, latencyMs };
  } catch (e) {
    const latencyMs = Date.now() - started;
    return {
      status: null,
      success: false,
      latencyMs,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function dispatchToWebhook(
  webhook: Webhook,
  payload: EventPayload,
): Promise<DispatchResult> {
  if (!webhook.events.includes(payload.event)) {
    return { attempts: 0, finalStatus: null, success: false, error: "not subscribed" };
  }
  const body = canonicalJson({
    event: payload.event,
    data: payload.data,
    delivered_at: new Date().toISOString(),
  });
  const timestamp = Math.floor(Date.now() / 1000);

  let last: Awaited<ReturnType<typeof postOnce>> | null = null;
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    const wait = BACKOFF_MS[i] ?? 0;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = await postOnce(webhook, body, timestamp, i + 1, payload.event);
    record({
      webhookId: webhook.id,
      event: payload.event,
      url: webhook.url,
      attempt: i + 1,
      statusCode: last.status,
      latencyMs: last.latencyMs,
      success: last.success,
      ...(last.error ? { error: last.error } : {}),
    });
    if (last.success) {
      return { attempts: i + 1, finalStatus: last.status, success: true };
    }
    // 4xx — record but stop retrying.
    if (last.status !== null && last.status >= 400 && last.status < 500) {
      return {
        attempts: i + 1,
        finalStatus: last.status,
        success: false,
        error: last.error ?? `http ${last.status}`,
      };
    }
  }
  return {
    attempts: BACKOFF_MS.length,
    finalStatus: last?.status ?? null,
    success: false,
    error: last?.error ?? "exhausted retries",
  };
}
