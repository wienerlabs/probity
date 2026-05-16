import { createHash } from "node:crypto";
import type { Citation, RuleOutcome } from "@probity/types";

// Canonical JSON: stable key order, no whitespace, primitives as-is.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(",")}}`;
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value);
}

export function hashEvidence(outcomes: RuleOutcome[]): string {
  const payload = outcomes.map((o) => ({
    ruleId: o.ruleId,
    ruleVersion: o.ruleVersion,
    outcome: o.outcome,
    material: o.material,
    evidence: o.evidence.map(stripVolatile),
  }));
  const h = createHash("sha256").update(canonicalJson(payload)).digest("hex");
  return `sha256:${h}`;
}

function stripVolatile(c: Citation): Citation {
  // Citations are already canonical; this hook is here in case future
  // citation kinds carry transient metadata we want to drop from the hash.
  return c;
}
