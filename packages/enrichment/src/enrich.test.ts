import { describe, expect, it } from "vitest";
import type { SolanaTokenState } from "@probity/types";
import { ClaudeClient } from "./claude";
import { enrichTokenFromDocs } from "./enrich";
import { parseEnrichmentJson, EnrichmentValidationError } from "./validate";

function fakeFetchOnce(jsonOutput: string): typeof fetch {
  return async () => {
    const body = {
      id: "msg_test",
      model: "claude-sonnet-4.5",
      role: "assistant" as const,
      content: [{ type: "text", text: jsonOutput }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 80 },
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function fakeFetchError(status: number, message: string): typeof fetch {
  return async () =>
    new Response(message, { status, headers: { "content-type": "text/plain" } });
}

const STATE: SolanaTokenState = {
  mint: "MintAddr111111111111111111111111111111111111",
  decimals: 6,
  supply: "1,000,000,000",
  mintAuthority: null,
  freezeAuthority: null,
  metadata: {
    name: "Demo",
    symbol: "DMO",
    uri: "ipfs://x",
    isMutable: false,
  },
  metadataAccount: "MetaPDA1111111111111111111111111111111111111",
  topHolderConcentration: 0.15,
  topHolders: [],
  programInteractions: [],
  snapshotSlot: 100,
};

describe("parseEnrichmentJson", () => {
  it("accepts a well-formed extraction", () => {
    const raw = JSON.stringify({
      revenueModel: {
        primary: "swap-fees",
        exposures: [
          {
            tag: "primary-utility",
            revenueShare: 0.9,
            rationale: "90% revenue from on-chain swap aggregation fees",
          },
          {
            tag: "infra",
            revenueShare: 0.1,
            rationale: "10% from routing rebates",
          },
        ],
        zeroSumRevenueShare: 0,
        utilityScore: 0.8,
      },
      governance: {
        timelockSeconds: 172800,
        multisigThreshold: { m: 4, n: 7 },
        freezeAuthoritySingleKey: false,
      },
    });
    const out = parseEnrichmentJson(raw);
    expect(out.revenueModel.primary).toBe("swap-fees");
    expect(out.revenueModel.exposures).toHaveLength(2);
    expect(out.revenueModel.exposures[0]?.source.type).toBe("derivation");
    expect(out.governance.timelockSeconds).toBe(172800);
    expect(out.governance.multisigThreshold).toEqual({ m: 4, n: 7 });
  });

  it("rejects unknown sector tags", () => {
    const raw = JSON.stringify({
      revenueModel: {
        primary: "x",
        exposures: [{ tag: "narcotics", revenueShare: 0.5, rationale: "" }],
        zeroSumRevenueShare: 0,
        utilityScore: 0.5,
      },
      governance: {
        timelockSeconds: null,
        multisigThreshold: null,
        freezeAuthoritySingleKey: false,
      },
    });
    expect(() => parseEnrichmentJson(raw)).toThrow(EnrichmentValidationError);
  });

  it("rejects out-of-range revenue shares", () => {
    const raw = JSON.stringify({
      revenueModel: {
        primary: "x",
        exposures: [{ tag: "gambling", revenueShare: 1.4, rationale: "" }],
        zeroSumRevenueShare: 0,
        utilityScore: 0.5,
      },
      governance: {
        timelockSeconds: null,
        multisigThreshold: null,
        freezeAuthoritySingleKey: false,
      },
    });
    expect(() => parseEnrichmentJson(raw)).toThrow(/out of range/);
  });

  it("rejects unparseable JSON", () => {
    expect(() => parseEnrichmentJson("not even json")).toThrow(
      /did not return parseable JSON/,
    );
  });

  it("rejects invalid multisig threshold", () => {
    const raw = JSON.stringify({
      revenueModel: {
        primary: "x",
        exposures: [],
        zeroSumRevenueShare: 0,
        utilityScore: 0.5,
      },
      governance: {
        timelockSeconds: 0,
        multisigThreshold: { m: 5, n: 3 },
        freezeAuthoritySingleKey: false,
      },
    });
    expect(() => parseEnrichmentJson(raw)).toThrow(/invalid threshold/);
  });
});

describe("enrichTokenFromDocs", () => {
  const validJson = JSON.stringify({
    revenueModel: {
      primary: "lending-spread",
      exposures: [
        {
          tag: "lending-interest",
          revenueShare: 0.74,
          rationale: "Issuer documentation cites USDC lending pool yield",
        },
      ],
      zeroSumRevenueShare: 0,
      utilityScore: 0.45,
    },
    governance: {
      timelockSeconds: null,
      multisigThreshold: null,
      freezeAuthoritySingleKey: true,
    },
  });

  it("produces an EnrichmentBundle that matches the engine input shape", async () => {
    const client = new ClaudeClient({
      apiKey: "test",
      fetchImpl: fakeFetchOnce(validJson),
    });
    const out = await enrichTokenFromDocs(
      {
        state: STATE,
        documents: [
          {
            kind: "whitepaper",
            url: "https://example.org/wp.md",
            excerpt: "Holders earn a variable APR sourced from a USDC lending pool.",
          },
          {
            kind: "audit",
            url: "https://example.org/audit.pdf",
            excerpt: "Q1 review of treasury yield mechanics.",
            contentHash: "sha256:abcd",
          },
        ],
      },
      { client },
    );
    expect(out.revenueModel.primary).toBe("lending-spread");
    expect(out.revenueModel.exposures[0]?.tag).toBe("lending-interest");
    expect(out.governance.freezeAuthoritySingleKey).toBe(true);
    expect(out.audits).toHaveLength(1);
    expect(out.audits[0]?.sourceUrl).toBe("https://example.org/audit.pdf");
  });

  it("strips a fenced code block before parsing", async () => {
    const fenced = "```json\n" + validJson + "\n```";
    const client = new ClaudeClient({
      apiKey: "test",
      fetchImpl: fakeFetchOnce(fenced),
    });
    const out = await enrichTokenFromDocs(
      { state: STATE, documents: [] },
      { client },
    );
    expect(out.revenueModel.primary).toBe("lending-spread");
  });

  it("surfaces Anthropic HTTP errors as ClaudeError", async () => {
    const client = new ClaudeClient({
      apiKey: "bad",
      fetchImpl: fakeFetchError(401, "invalid key"),
    });
    await expect(
      enrichTokenFromDocs({ state: STATE, documents: [] }, { client }),
    ).rejects.toThrow(/Anthropic HTTP 401/);
  });
});
