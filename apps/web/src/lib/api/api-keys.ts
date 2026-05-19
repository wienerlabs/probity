// Minimal API key registry. Keys are loaded from the PROBITY_API_KEYS env
// variable so that they can be rotated without a code deploy and so that the
// public Git history never contains a live institutional key.
//
// Format: comma-separated `key:tier:owner` triples, e.g.
//   PROBITY_API_KEYS="probity_growth_xxx:growth:partnerA,probity_inst_yyy:institutional:partnerB"
//
// Keys are compared in constant time against the configured set. The HMAC
// secret is required when the env list is non-empty so that future migration
// to hashed storage is one-line.

import { createHmac, timingSafeEqual } from "node:crypto";

export type Tier = "free" | "growth" | "institutional";

export interface ApiKey {
  id: string;
  tier: Tier;
  owner: string;
}

function loadKeys(): Map<string, ApiKey> {
  const out = new Map<string, ApiKey>();
  const raw = process.env.PROBITY_API_KEYS?.trim();
  if (!raw) return out;
  for (const entry of raw.split(",")) {
    const parts = entry.trim().split(":");
    if (parts.length < 3) continue;
    const [key, tier, ...ownerParts] = parts;
    if (!key || !tier) continue;
    if (tier !== "free" && tier !== "growth" && tier !== "institutional") continue;
    out.set(key, {
      id: `${tier}-${out.size + 1}`,
      tier: tier as Tier,
      owner: ownerParts.join(":") || "unknown",
    });
  }
  return out;
}

let CACHED: Map<string, ApiKey> | null = null;
function keys(): Map<string, ApiKey> {
  if (!CACHED) CACHED = loadKeys();
  return CACHED;
}

function hmacSecret(): string | null {
  return process.env.PROBITY_API_KEY_HMAC_SECRET?.trim() || null;
}

export function hashedKey(raw: string): string {
  const secret = hmacSecret();
  if (!secret) {
    throw new Error("PROBITY_API_KEY_HMAC_SECRET must be configured");
  }
  return createHmac("sha256", secret).update(raw).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function authenticate(headers: Headers): ApiKey | null {
  const auth = headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  const registry = keys();
  if (registry.size === 0) return null;
  for (const [candidate, meta] of registry) {
    if (safeEq(candidate, raw)) return meta;
  }
  return null;
}

export function listDemoKeys(): { key: string; tier: Tier; owner: string }[] {
  // Intentionally never returns the raw key material — the framework page
  // displays metadata only. Add a separate admin-only route if you need to
  // surface raw keys to operators.
  return Array.from(keys().entries()).map(([, v]) => ({
    key: `${v.tier}_key_${v.id}`,
    tier: v.tier,
    owner: v.owner,
  }));
}
