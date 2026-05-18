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
You are a senior Islamic-finance compliance analyst (AAOIFI-aligned) evaluating
a Solana token. Use ONLY the supplied evidence — on-chain state, observed
program interactions, the issuer's metadata JSON, and the homepage excerpt.
Do not invent revenue mechanics that are not present in the evidence. Do not
project the token's "general" reputation. If the evidence is silent on a
point, mark it with a conservative default rather than guessing.

Hard rules:
- "exposures" MUST be an attribution decomposition of a single revenue line.
  Their revenueShare values MUST sum to ≤ 1.0. If the evidence describes
  multiple independent revenue streams, weight them so the total ≤ 1.0.
- A wrapper / synthetic / index token with no commercial issuer revenue
  should report an empty "exposures" array and primary like
  "wrapper-no-issuer-revenue".
- "lending-interest" tag applies only when the token's holders earn yield
  sourced from interest-bearing lending. Liquid-staking yield is "infra".
- "primary-utility" is reserved for tokens whose revenue is fees on an
  identifiable on-chain service. Memecoins without an utility venue are
  NOT "primary-utility".
- "utilityScore": 0 for pure speculation, ~0.4 for unclear utility, ~0.8 for
  clear active utility, 1.0 only for foundational infrastructure (e.g.
  native gas tokens, oracle networks).
- If evidence is unavailable to set governance fields, return null for
  timelockSeconds and multisigThreshold and false for freezeAuthoritySingleKey.
- For every exposure, populate "source_url" with the exact URL of the
  document the rationale was extracted from. If the rationale comes
  from on-chain state with no doc reference, use null.

Output JSON only. No prose. No code fences.

Schema:
{
  "revenueModel": {
    "primary": string,                     // short label, e.g. "lending-spread"
    "exposures": [
      {
        "tag": "alcohol" | "gambling" | "adult" | "tobacco" | "weapons" |
               "conventional-finance" | "pork" | "lending-interest" |
               "primary-utility" | "marketplace" | "gaming" | "stablecoin" |
               "infra",
        "revenueShare": 0..1,
        "rationale": string,               // <= 240 chars, cite the supplied evidence
        "source_url": string | null        // URL of the doc the rationale came from
      }
    ],
    "zeroSumRevenueShare": 0..1,
    "utilityScore": 0..1,
    "primarySaleRatio": 0..1 | null
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
