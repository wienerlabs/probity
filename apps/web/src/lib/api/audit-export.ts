import { createHmac, generateKeyPairSync, sign as edSign, KeyObject, createPrivateKey } from "node:crypto";
import { buildCitationIndex, summarizeCitations } from "@probity/engine";
import type { VerdictRecord } from "@probity/types";
import { getChanges, getHistory, getRecentByMint } from "@/lib/screening";

const HMAC_SECRET = process.env.PROBITY_EXPORT_HMAC_SECRET ?? "probity-dev-export";

export interface AuditEnvelope {
  schema: "probity.audit-export.v2";
  issuer: string;
  issued_at: string;
  issued_to: string;
  mint: string;
  rule_version: string;
  verdict: VerdictRecord;
  context: unknown;
  enrichment_source: string;
  evidence: {
    scanned_transactions: number;
    scanned_program_hits: number;
    known_programs: number;
    unknown_programs: number;
    documents_ingested: number;
  };
  consensus?: unknown;
  documents: unknown[];
  citation_index: {
    total_unique: number;
    document_count: number;
    onchain_count: number;
    derivation_count: number;
    unique_document_urls: string[];
    unique_onchain_accounts: string[];
    entries: ReturnType<typeof buildCitationIndex>["entries"];
  };
  history: Array<{
    verdict: VerdictRecord["verdict"];
    computed_at: string;
    evidence_hash: string;
    consensus_confidence: number | null;
  }>;
  changes: Array<{
    from: VerdictRecord["verdict"] | null;
    to: VerdictRecord["verdict"];
    detected_at: string;
    outcome_deltas: number;
    score_deltas: number;
    new_citations: number;
    removed_citations: number;
  }>;
}

export interface SignedAudit {
  envelope: AuditEnvelope;
  signature: {
    algorithm: "hmac-sha256" | "ed25519";
    value: string;
    public_key?: string;
  };
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

export function buildAuditEnvelope(
  mint: string,
  ruleVersion: string,
  issuedTo: string,
): AuditEnvelope | null {
  const cached = getRecentByMint(mint);
  if (!cached) return null;
  if (cached.verdict.ruleVersion !== ruleVersion) return null;

  const idx = buildCitationIndex(cached.verdict.outcomes);
  const summary = summarizeCitations(cached.verdict);
  const history = getHistory(mint, 50).map((h) => ({
    verdict: h.verdict.verdict,
    computed_at: h.verdict.computedAt,
    evidence_hash: h.verdict.evidenceHash,
    consensus_confidence: h.consensus?.confidence ?? null,
  }));
  const changes = getChanges(mint, 50).map((c) => ({
    from: c.previousVerdict,
    to: c.newVerdict,
    detected_at: c.detectedAt,
    outcome_deltas: c.diff.outcomeDeltas.length,
    score_deltas: c.diff.scoreDeltas.length,
    new_citations: c.diff.newCitations,
    removed_citations: c.diff.removedCitations,
  }));

  return {
    schema: "probity.audit-export.v2",
    issuer: "Probity (Wiener Labs)",
    issued_at: new Date().toISOString(),
    issued_to: issuedTo,
    mint,
    rule_version: ruleVersion,
    verdict: cached.verdict,
    context: cached.context,
    enrichment_source: cached.enrichmentSource,
    evidence: {
      scanned_transactions: cached.evidence.scannedTransactions,
      scanned_program_hits: cached.evidence.scannedProgramHits,
      known_programs: cached.evidence.knownPrograms,
      unknown_programs: cached.evidence.unknownPrograms,
      documents_ingested: cached.evidence.documentsIngested,
    },
    ...(cached.consensus ? { consensus: cached.consensus } : {}),
    documents: cached.documents,
    citation_index: {
      total_unique: summary.totalUnique,
      document_count: summary.documentCount,
      onchain_count: summary.onchainCount,
      derivation_count: summary.derivationCount,
      unique_document_urls: idx.uniqueDocumentUrls,
      unique_onchain_accounts: idx.uniqueOnchainAccounts,
      entries: idx.entries,
    },
    history,
    changes,
  };
}

interface Ed25519Keys {
  privateKey: KeyObject;
  publicKeyB64: string;
}

let CACHED_ED: Ed25519Keys | null = null;

function loadEd25519(): Ed25519Keys | null {
  if (CACHED_ED) return CACHED_ED;
  const pem = process.env.PROBITY_SIGNING_PRIVATE_KEY_PEM;
  if (pem) {
    const privateKey = createPrivateKey({ key: pem, format: "pem" });
    const publicKey = (privateKey as unknown as { asymmetricKeyDetails?: unknown });
    void publicKey;
    const pub = (
      privateKey as unknown as { export: (o: { format: string; type: string }) => string }
    ).export({ format: "der", type: "spki" });
    void pub;
    // Round-trip the public via JWK to base64 cleanly.
    const jwk = (privateKey as unknown as { export: (o: { format: string }) => unknown }).export({
      format: "jwk",
    }) as { x?: string };
    if (!jwk.x) return null;
    CACHED_ED = { privateKey, publicKeyB64: jwk.x };
    return CACHED_ED;
  }
  if (process.env.PROBITY_SIGNING_AUTOGEN === "1") {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const jwk = (publicKey as unknown as { export: (o: { format: string }) => unknown }).export({
      format: "jwk",
    }) as { x?: string };
    if (!jwk.x) return null;
    CACHED_ED = { privateKey, publicKeyB64: jwk.x };
    return CACHED_ED;
  }
  return null;
}

export function signEnvelope(envelope: AuditEnvelope): SignedAudit {
  const canonical = canonicalJson(envelope);
  const ed = loadEd25519();
  if (ed) {
    const sig = edSign(null, Buffer.from(canonical), ed.privateKey);
    return {
      envelope,
      signature: {
        algorithm: "ed25519",
        value: sig.toString("base64"),
        public_key: ed.publicKeyB64,
      },
    };
  }
  const hmac = createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");
  return {
    envelope,
    signature: { algorithm: "hmac-sha256", value: hmac },
  };
}
