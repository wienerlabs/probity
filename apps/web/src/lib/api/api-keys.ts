// Minimal API key registry. Demo-mode only; real keys must be issued
// through the institutional dashboard and stored as HMAC hashes server-
// side. Until that lands, this module:
//   - accepts probity_demo_* keys from the env-supplied allow-list
//   - associates each key with a tier (free / growth / institutional)
//   - exposes hashedKey() for future migration

import { createHmac } from "node:crypto";

export type Tier = "free" | "growth" | "institutional";

export interface ApiKey {
  id: string;
  tier: Tier;
  owner: string;
}

const HMAC_SECRET = process.env.PROBITY_API_KEY_HMAC_SECRET ?? "probity-dev-secret";

// Demo keys — visible in the framework page and ship in .env.example so
// people can curl the API without onboarding. Replace before launch.
const DEMO_KEYS: Record<string, ApiKey> = {
  probity_demo_growth_key_a1b2c3: {
    id: "demo-growth",
    tier: "growth",
    owner: "demo",
  },
  probity_demo_institutional_d4e5f6: {
    id: "demo-institutional",
    tier: "institutional",
    owner: "demo",
  },
};

export function hashedKey(raw: string): string {
  return createHmac("sha256", HMAC_SECRET).update(raw).digest("hex");
}

export function authenticate(headers: Headers): ApiKey | null {
  const auth = headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  return DEMO_KEYS[raw] ?? null;
}

export function listDemoKeys(): { key: string; tier: Tier; owner: string }[] {
  return Object.entries(DEMO_KEYS).map(([key, v]) => ({
    key,
    tier: v.tier,
    owner: v.owner,
  }));
}
