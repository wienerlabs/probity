import { describe, expect, it } from "vitest";
import type { RuleOutcome } from "@probity/types";
import {
  buildCitationIndex,
  explorerAccountUrl,
  explorerSlotUrl,
  explorerTxUrl,
  summarizeCitations,
} from "./citations";

const RIBA_ACCOUNT = "MarginLendingV3Pr0gramId000000000000000000";
const MINT = "Pr0biTy22222222222222222222222222222222UTL2";

function mkOnchainOutcome(): RuleOutcome {
  return {
    ruleId: "riba.lending-protocol-interaction",
    ruleVersion: "0.1.0",
    category: "riba",
    material: true,
    outcome: "fail",
    rationale: "lending program seen in interactions",
    evidence: [
      {
        type: "onchain",
        account: RIBA_ACCOUNT,
        slot: 318_402_889,
        field: "program_interactions",
        value: "primary_revenue_via_interest_lending_pool",
      },
      {
        type: "derivation",
        formula: "sum(primaryRevenueShare where kind=lending-interest-bearing) = 0.74",
        result: "fail",
      },
    ],
  };
}

function mkDocOutcome(): RuleOutcome {
  return {
    ruleId: "haram-sector.exposure",
    ruleVersion: "0.1.0",
    category: "haram-sector",
    material: true,
    outcome: "fail",
    rationale: "treasury yields from US Treasuries; interest accrues to issuer",
    evidence: [
      {
        type: "document",
        sourceUrl: "https://example.org/wp.pdf",
        contentHash: "sha256:abc",
        excerpt: "Reserves held in US Treasuries; Circle earns interest.",
      },
      {
        type: "document",
        sourceUrl: "https://example.org/wp.pdf",
        contentHash: "sha256:abc",
        excerpt: "duplicate-on-purpose",
      },
    ],
  };
}

function mkGovOutcome(): RuleOutcome {
  return {
    ruleId: "governance.proposal-transparency",
    ruleVersion: "0.1.0",
    category: "governance",
    material: false,
    outcome: "flag",
    rationale: "freeze authority single key",
    evidence: [
      {
        type: "onchain",
        account: MINT,
        slot: 318_402_993,
        field: "freeze_authority",
        value: "SingleHotK3y00000000000000000000000000000000",
      },
    ],
  };
}

describe("explorer URL builders", () => {
  it("builds mainnet account URLs", () => {
    expect(explorerAccountUrl(MINT)).toBe(
      `https://explorer.solana.com/address/${MINT}`,
    );
  });

  it("appends devnet cluster", () => {
    expect(explorerAccountUrl(MINT, "devnet")).toContain("?cluster=devnet");
  });

  it("builds tx URLs", () => {
    expect(explorerTxUrl("5sigsig")).toBe("https://explorer.solana.com/tx/5sigsig");
  });

  it("builds slot URLs", () => {
    expect(explorerSlotUrl(123456789)).toBe(
      "https://explorer.solana.com/block/123456789",
    );
  });
});

describe("buildCitationIndex", () => {
  it("dedupes citations by canonical key across outcomes", () => {
    const idx = buildCitationIndex([mkDocOutcome(), mkDocOutcome()]);
    expect(idx.byKind.document.length).toBe(1);
    expect(idx.byKind.derivation.length).toBe(0);
  });

  it("collects unique document URLs across all outcomes", () => {
    const a = mkDocOutcome();
    const b = { ...mkDocOutcome(), evidence: [...mkDocOutcome().evidence] };
    b.evidence[0] = {
      ...b.evidence[0]!,
      sourceUrl: "https://example.org/audit.pdf",
      contentHash: "sha256:def",
    } as typeof b.evidence[0];
    const idx = buildCitationIndex([a, b]);
    expect(idx.uniqueDocumentUrls.length).toBeGreaterThanOrEqual(2);
    expect(idx.uniqueDocumentUrls).toContain("https://example.org/wp.pdf");
    expect(idx.uniqueDocumentUrls).toContain("https://example.org/audit.pdf");
  });

  it("attaches a Solana Explorer URL to every on-chain citation", () => {
    const idx = buildCitationIndex([mkOnchainOutcome(), mkGovOutcome()]);
    const onchain = idx.entries.filter((e) => e.kind === "onchain");
    expect(onchain.length).toBeGreaterThan(0);
    for (const e of onchain) {
      expect(e.explorerUrl).toMatch(/^https:\/\/explorer\.solana\.com\/address\//);
    }
  });

  it("tracks which rules cite which citation id", () => {
    const idx = buildCitationIndex([mkOnchainOutcome(), mkGovOutcome()]);
    expect(idx.byRule["riba.lending-protocol-interaction"]).toBeDefined();
    expect(idx.byRule["governance.proposal-transparency"]).toBeDefined();
    expect(
      idx.byRule["riba.lending-protocol-interaction"]!.length,
    ).toBeGreaterThan(0);
  });

  it("returns derivation citations without explorer URLs", () => {
    const idx = buildCitationIndex([mkOnchainOutcome()]);
    const derivations = idx.entries.filter((e) => e.kind === "derivation");
    expect(derivations.length).toBe(1);
    expect(derivations[0]!.explorerUrl).toBeUndefined();
  });

  it("expands derivation inputs into top-level entries with shared rule attribution", () => {
    const outcome: RuleOutcome = {
      ruleId: "x",
      ruleVersion: "0.1.0",
      category: "riba",
      material: true,
      outcome: "fail",
      rationale: "x",
      evidence: [
        {
          type: "derivation",
          formula: "f",
          result: "r",
          inputs: [
            {
              type: "document",
              sourceUrl: "https://example.org/seed.pdf",
              contentHash: "sha256:000",
              excerpt: "seed",
            },
          ],
        },
      ],
    };
    const idx = buildCitationIndex([outcome]);
    expect(idx.uniqueDocumentUrls).toContain("https://example.org/seed.pdf");
    expect(idx.byRule["x"]!.length).toBe(2);
  });
});

describe("summarizeCitations", () => {
  it("counts by kind across a full verdict", () => {
    const verdict = {
      mint: MINT,
      verdict: "haram" as const,
      ruleVersion: "0.1.0",
      computedAt: "2026-05-18T00:00:00Z",
      expiresAt: "2026-06-17T00:00:00Z",
      evidenceHash: "sha256:zzz",
      attestationPubkey: null,
      outcomes: [mkOnchainOutcome(), mkDocOutcome(), mkGovOutcome()],
      scoreBreakdown: {
        riba: 0,
        maysir: 1,
        gharar: 1,
        sector: 0,
        governance: 0.5,
        transparency: 1,
      },
    };
    const s = summarizeCitations(verdict);
    expect(s.documentCount).toBeGreaterThanOrEqual(1);
    expect(s.onchainCount).toBeGreaterThanOrEqual(2);
    expect(s.derivationCount).toBeGreaterThanOrEqual(1);
    expect(s.totalUnique).toBe(
      s.documentCount + s.onchainCount + s.derivationCount,
    );
  });
});
