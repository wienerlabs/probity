import type {
  CitationDocument,
  EnrichmentBundle,
  SolanaTokenState,
} from "@probity/types";
import { ClaudeClient } from "./claude";
import { bundleFromExtraction, parseEnrichmentJson } from "./validate";

export interface DocumentSource {
  kind: "whitepaper" | "audit" | "tokenomics" | "governance" | "other";
  url: string;
  excerpt: string; // pre-fetched body or trimmed extract
  contentHash?: string;
}

export interface EnrichmentInput {
  state: SolanaTokenState;
  documents: DocumentSource[];
}

const SYSTEM_PROMPT = `
You are a senior Islamic-finance compliance analyst evaluating a Solana token.
Extract a structured revenue model and governance shape from the supplied
on-chain state and off-chain documents. Be conservative — when the evidence
is incomplete, prefer narrower exposure tags and a lower utility score over
fabrication. Output JSON only. No prose. No code fences.

Schema:
{
  "revenueModel": {
    "primary": string,                     // one-line label, e.g. "lending-spread"
    "exposures": [
      {
        "tag": "alcohol" | "gambling" | "adult" | "tobacco" | "weapons" |
               "conventional-finance" | "pork" | "lending-interest" |
               "primary-utility" | "marketplace" | "gaming" | "stablecoin" |
               "infra",
        "revenueShare": 0..1,
        "rationale": string                // <= 240 chars, cite evidence
      }
    ],
    "zeroSumRevenueShare": 0..1,
    "utilityScore": 0..1,                  // higher = clearer real-world utility
    "primarySaleRatio": 0..1 | null        // optional, only for marketplaces
  },
  "governance": {
    "timelockSeconds": number | null,
    "multisigThreshold": { "m": int, "n": int } | null,
    "freezeAuthoritySingleKey": boolean
  }
}
`.trim();

function userPrompt(input: EnrichmentInput): string {
  const s = input.state;
  const docs = input.documents
    .map(
      (d) =>
        `[${d.kind}] ${d.url}\n${d.excerpt.slice(0, 3200)}${
          d.excerpt.length > 3200 ? "\n…(truncated)" : ""
        }`,
    )
    .join("\n\n---\n\n");
  const interactions = s.programInteractions
    .map(
      (p) =>
        `  - ${p.program} kind=${p.kind} primary_revenue_share=${p.primaryRevenueShare.toFixed(2)}`,
    )
    .join("\n");
  return `Token:
  mint:            ${s.mint}
  symbol/name:     ${s.metadata.symbol} / ${s.metadata.name}
  decimals:        ${s.decimals}
  supply:          ${s.supply}
  mint_authority:  ${s.mintAuthority ?? "renounced"}
  freeze_authority:${s.freezeAuthority ?? "renounced"}
  metadata_mutable:${s.metadata.isMutable}
  top10_concentration:${(s.topHolderConcentration * 100).toFixed(1)}%
  program_interactions:
${interactions || "  (none observed)"}

Documents:
${docs || "(none supplied)"}

Return the JSON object. No prose.`;
}

export interface EnrichOptions {
  client: ClaudeClient;
  temperature?: number;
}

export async function enrichTokenFromDocs(
  input: EnrichmentInput,
  opts: EnrichOptions,
): Promise<EnrichmentBundle> {
  const raw = await opts.client.ask({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(input) }],
    maxTokens: 1600,
    temperature: opts.temperature ?? 0,
  });

  const json = stripCodeFence(raw);
  const parsed = parseEnrichmentJson(json);

  // Compose citation set from supplied documents.
  const audits: CitationDocument[] = input.documents
    .filter((d) => d.kind === "audit")
    .map((d) => ({
      type: "document",
      sourceUrl: d.url,
      contentHash: d.contentHash ?? "sha256:unknown",
      excerpt: d.excerpt.slice(0, 480),
    }));

  return bundleFromExtraction(parsed, audits);
}

function stripCodeFence(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    const inner = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return inner.trim();
  }
  return trimmed;
}
