import { randomBytes, randomUUID } from "node:crypto";

export type WebhookEvent = "verdict.changed" | "verdict.computed" | "attestation.revoked";

export interface Webhook {
  id: string;
  owner: string;
  url: string;
  events: WebhookEvent[];
  // Hex secret used by the caller to verify HMAC-SHA-256 signatures we
  // send on dispatch (Ed25519 promised in the spec — that requires a
  // signer keypair which lives behind PROBITY_SIGNING_KEY; for now we
  // fall back to HMAC + shared secret).
  secret: string;
  createdAt: string;
}

const STORE = new Map<string, Webhook>();

export function listForOwner(owner: string): Webhook[] {
  return [...STORE.values()].filter((w) => w.owner === owner);
}

export function createWebhook(input: {
  owner: string;
  url: string;
  events: WebhookEvent[];
}): Webhook {
  const w: Webhook = {
    id: randomUUID(),
    owner: input.owner,
    url: input.url,
    events: input.events,
    secret: randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  STORE.set(w.id, w);
  return w;
}

export function deleteWebhook(owner: string, id: string): boolean {
  const w = STORE.get(id);
  if (!w || w.owner !== owner) return false;
  return STORE.delete(id);
}
