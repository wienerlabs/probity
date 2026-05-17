// In-memory store of recent live verdicts.
// Module-scoped — resets on cold start. Acceptable for the demo / single
// instance; durability is a launch gate (M6.5 → Supabase or Upstash).

import type { ScreeningContext, VerdictRecord } from "@probity/types";

export interface RecentEntry {
  verdict: VerdictRecord;
  context: ScreeningContext;
  enrichmentSource: "claude" | "synthesised";
  pushedAt: string; // ISO
}

const MAX_RECENT = 20;
const RECENT: RecentEntry[] = [];

export function pushRecent(entry: Omit<RecentEntry, "pushedAt">): void {
  // Replace any prior entry for the same mint+rule_version pair —
  // re-screening the same token should bump, not duplicate.
  const k = `${entry.verdict.mint}@${entry.verdict.ruleVersion}`;
  const idx = RECENT.findIndex(
    (e) => `${e.verdict.mint}@${e.verdict.ruleVersion}` === k,
  );
  const next: RecentEntry = { ...entry, pushedAt: new Date().toISOString() };
  if (idx >= 0) {
    RECENT.splice(idx, 1);
  }
  RECENT.unshift(next);
  while (RECENT.length > MAX_RECENT) RECENT.pop();
}

export function getRecent(limit = MAX_RECENT): RecentEntry[] {
  return RECENT.slice(0, limit);
}

export function getRecentByMint(mint: string): RecentEntry | undefined {
  return RECENT.find((e) => e.verdict.mint === mint);
}

export function clearRecent(): void {
  RECENT.length = 0;
}
