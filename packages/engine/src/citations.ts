import { createHash } from "node:crypto";
import type {
  Citation,
  CitationDerivation,
  CitationDocument,
  CitationOnchain,
  RuleOutcome,
  VerdictRecord,
} from "@probity/types";

export type CitationKind = "onchain" | "document" | "derivation";

export interface CitationIndexEntry {
  id: string;
  kind: CitationKind;
  ruleIds: string[];
  citation: Citation;
  explorerUrl?: string;
}

export interface CitationIndex {
  entries: CitationIndexEntry[];
  byRule: Record<string, string[]>;
  byKind: Record<CitationKind, string[]>;
  uniqueDocumentUrls: string[];
  uniqueOnchainAccounts: string[];
}

const SOLANA_EXPLORER_BASE = "https://explorer.solana.com";

export function explorerAccountUrl(account: string, cluster: "mainnet" | "devnet" = "mainnet"): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `${SOLANA_EXPLORER_BASE}/address/${encodeURIComponent(account)}${suffix}`;
}

export function explorerTxUrl(signature: string, cluster: "mainnet" | "devnet" = "mainnet"): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `${SOLANA_EXPLORER_BASE}/tx/${encodeURIComponent(signature)}${suffix}`;
}

export function explorerSlotUrl(slot: number, cluster: "mainnet" | "devnet" = "mainnet"): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `${SOLANA_EXPLORER_BASE}/block/${slot}${suffix}`;
}

function canonicalCitationKey(c: Citation): string {
  if (c.type === "onchain") {
    return `onchain::${c.account}::${c.field}::${c.value}`;
  }
  if (c.type === "document") {
    return `document::${c.sourceUrl}::${c.contentHash}`;
  }
  return `derivation::${c.formula}::${c.result}`;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function explorerFor(c: Citation): string | undefined {
  if (c.type === "onchain") {
    return explorerAccountUrl((c as CitationOnchain).account);
  }
  return undefined;
}

export function buildCitationIndex(outcomes: RuleOutcome[]): CitationIndex {
  const byId = new Map<string, CitationIndexEntry>();
  const byRule: Record<string, string[]> = {};
  const byKind: Record<CitationKind, string[]> = {
    onchain: [],
    document: [],
    derivation: [],
  };

  for (const o of outcomes) {
    byRule[o.ruleId] = byRule[o.ruleId] ?? [];
    for (const c of o.evidence) {
      const key = canonicalCitationKey(c);
      const id = hashKey(key);
      let entry = byId.get(id);
      if (!entry) {
        const exp = explorerFor(c);
        entry = {
          id,
          kind: c.type,
          ruleIds: [],
          citation: c,
          ...(exp ? { explorerUrl: exp } : {}),
        };
        byId.set(id, entry);
        byKind[c.type].push(id);
      }
      if (!entry.ruleIds.includes(o.ruleId)) entry.ruleIds.push(o.ruleId);
      if (!byRule[o.ruleId]!.includes(id)) byRule[o.ruleId]!.push(id);

      if (c.type === "derivation") {
        const der = c as CitationDerivation;
        if (der.inputs) {
          for (const inner of der.inputs) {
            const innerKey = canonicalCitationKey(inner);
            const innerId = hashKey(innerKey);
            let innerEntry = byId.get(innerId);
            if (!innerEntry) {
              const innerExp = explorerFor(inner);
              innerEntry = {
                id: innerId,
                kind: inner.type,
                ruleIds: [],
                citation: inner,
                ...(innerExp ? { explorerUrl: innerExp } : {}),
              };
              byId.set(innerId, innerEntry);
              byKind[inner.type].push(innerId);
            }
            if (!innerEntry.ruleIds.includes(o.ruleId))
              innerEntry.ruleIds.push(o.ruleId);
            if (!byRule[o.ruleId]!.includes(innerId))
              byRule[o.ruleId]!.push(innerId);
          }
        }
      }
    }
  }

  const entries = [...byId.values()];
  const uniqueDocumentUrls = entries
    .filter((e): e is CitationIndexEntry & { citation: CitationDocument } => e.kind === "document")
    .map((e) => e.citation.sourceUrl);
  const uniqueOnchainAccounts = entries
    .filter((e): e is CitationIndexEntry & { citation: CitationOnchain } => e.kind === "onchain")
    .map((e) => e.citation.account);

  return {
    entries,
    byRule,
    byKind,
    uniqueDocumentUrls: [...new Set(uniqueDocumentUrls)],
    uniqueOnchainAccounts: [...new Set(uniqueOnchainAccounts)],
  };
}

export function citationIdFor(c: Citation): string {
  return hashKey(canonicalCitationKey(c));
}

export function ruleIdsForCitation(
  index: CitationIndex,
  citationId: string,
): string[] {
  const entry = index.entries.find((e) => e.id === citationId);
  return entry ? [...entry.ruleIds] : [];
}

export function summarizeCitations(verdict: VerdictRecord): {
  documentCount: number;
  onchainCount: number;
  derivationCount: number;
  totalUnique: number;
} {
  const idx = buildCitationIndex(verdict.outcomes);
  return {
    documentCount: idx.byKind.document.length,
    onchainCount: idx.byKind.onchain.length,
    derivationCount: idx.byKind.derivation.length,
    totalUnique: idx.entries.length,
  };
}
