import { describe, expect, it, beforeEach } from "vitest";
import type { ScreeningContext, VerdictRecord } from "@probity/types";
import { openDb } from "./db";
import { computeDiff, VerdictRepository } from "./repository";

const MINT_A = "Pr0biTy22222222222222222222222222222222UTL2";
const MINT_B = "Pr0biTy33333333333333333333333333333333LND3";

function mkContext(mint: string): ScreeningContext {
  return {
    mint,
    ruleVersion: "0.1.0",
    now: new Date("2026-05-18T00:00:00Z"),
    state: {
      mint,
      decimals: 6,
      supply: "1",
      mintAuthority: null,
      freezeAuthority: null,
      metadata: { name: "Demo", symbol: "DMO", uri: "", isMutable: false },
      metadataAccount: "",
      topHolderConcentration: 0,
      topHolders: [],
      programInteractions: [],
      snapshotSlot: 1,
      tokenProgram: "spl-token",
    },
    enrichment: {
      audits: [],
      revenueModel: {
        primary: "swap",
        exposures: [],
        zeroSumRevenueShare: 0,
        utilityScore: 0.8,
      },
      governance: {
        timelockSeconds: null,
        multisigThreshold: null,
        freezeAuthoritySingleKey: false,
      },
    },
  };
}

function mkVerdict(
  mint: string,
  verdict: VerdictRecord["verdict"],
  computedAt = "2026-05-18T00:00:00Z",
  outcomes?: VerdictRecord["outcomes"],
): VerdictRecord {
  return {
    mint,
    verdict,
    ruleVersion: "0.1.0",
    computedAt,
    expiresAt: "2026-06-17T00:00:00Z",
    evidenceHash: `sha256:${verdict}-${computedAt}`,
    attestationPubkey: null,
    outcomes: outcomes ?? [
      {
        ruleId: "riba.lending-protocol-interaction",
        ruleVersion: "0.1.0",
        category: "riba",
        material: true,
        outcome: verdict === "haram" ? "fail" : "pass",
        rationale: "test",
        evidence: [],
      },
    ],
    scoreBreakdown: {
      riba: verdict === "haram" ? 0 : 1,
      maysir: 1,
      gharar: 1,
      sector: 1,
      governance: 1,
      transparency: 1,
    },
  };
}

function mkInput(mint: string, verdict: VerdictRecord["verdict"], computedAt?: string) {
  const v = mkVerdict(mint, verdict, computedAt);
  return {
    context: { ...mkContext(mint), mint, now: new Date(v.computedAt) },
    verdict: v,
    documents: [],
    warnings: [],
    evidence: {
      scannedTransactions: 50,
      scannedProgramHits: 100,
      knownPrograms: 2,
      unknownPrograms: 3,
      documentsIngested: 0,
    },
    enrichmentSource: "claude",
  };
}

describe("VerdictRepository — persist + read", () => {
  let repo: VerdictRepository;

  beforeEach(() => {
    const db = openDb({ path: ":memory:" });
    repo = new VerdictRepository(db);
  });

  it("persists a verdict, returns id, latestForMint reads it back hydrated", () => {
    const r = repo.persist(mkInput(MINT_A, "halal"));
    expect(r.id).toBeGreaterThan(0);
    expect(r.changed).toBe(true);
    const latest = repo.latestForMint(MINT_A);
    expect(latest).not.toBeNull();
    expect(latest!.verdict).toBe("halal");
    expect(latest!.verdictRecord.outcomes).toHaveLength(1);
    expect(latest!.context.mint).toBe(MINT_A);
    expect(latest!.scannedTransactions).toBe(50);
  });

  it("history orders newest-first and respects the limit", () => {
    repo.persist(mkInput(MINT_A, "halal", "2026-05-10T00:00:00Z"));
    repo.persist(mkInput(MINT_A, "mushtabah", "2026-05-12T00:00:00Z"));
    repo.persist(mkInput(MINT_A, "haram", "2026-05-15T00:00:00Z"));
    const all = repo.historyForMint(MINT_A);
    expect(all).toHaveLength(3);
    expect(all[0]?.verdict).toBe("haram");
    expect(all[2]?.verdict).toBe("halal");
    const top1 = repo.historyForMint(MINT_A, 1);
    expect(top1).toHaveLength(1);
    expect(top1[0]?.verdict).toBe("haram");
  });

  it("listRecent returns the latest verdict per mint, newest computed_at first", () => {
    repo.persist(mkInput(MINT_A, "halal", "2026-05-10T00:00:00Z"));
    repo.persist(mkInput(MINT_A, "haram", "2026-05-15T00:00:00Z"));
    repo.persist(mkInput(MINT_B, "halal", "2026-05-12T00:00:00Z"));
    const recent = repo.listRecent();
    expect(recent).toHaveLength(2);
    const byMint = Object.fromEntries(recent.map((r) => [r.mint, r.verdict]));
    expect(byMint[MINT_A]).toBe("haram");
    expect(byMint[MINT_B]).toBe("halal");
    expect(recent[0]?.mint).toBe(MINT_A);
  });

  it("countByVerdict tallies the latest verdict per mint", () => {
    repo.persist(mkInput(MINT_A, "halal", "2026-05-10T00:00:00Z"));
    repo.persist(mkInput(MINT_A, "haram", "2026-05-15T00:00:00Z"));
    repo.persist(mkInput(MINT_B, "halal", "2026-05-12T00:00:00Z"));
    const counts = repo.countByVerdict();
    expect(counts).toEqual({ halal: 1, mushtabah: 0, haram: 1 });
  });

  it("records a verdict_change row when verdict label flips", () => {
    repo.persist(mkInput(MINT_A, "halal", "2026-05-10T00:00:00Z"));
    const second = repo.persist(mkInput(MINT_A, "haram", "2026-05-15T00:00:00Z"));
    expect(second.changed).toBe(true);
    const changes = repo.changesForMint(MINT_A);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.previousVerdict).toBe("halal");
    expect(changes[0]?.newVerdict).toBe("haram");
    expect(changes[0]?.diff.verdictChanged).toBe(true);
  });

  it("first verdict for a mint is reported as changed=true with no previous id", () => {
    const first = repo.persist(mkInput(MINT_A, "halal"));
    expect(first.changed).toBe(true);
    expect(first.previousId).toBeNull();
    expect(repo.changesForMint(MINT_A)).toHaveLength(0);
  });

  it("does not write a change row when no outcomes or verdict moved", () => {
    repo.persist(mkInput(MINT_A, "halal", "2026-05-10T00:00:00Z"));
    const second = repo.persist(mkInput(MINT_A, "halal", "2026-05-12T00:00:00Z"));
    expect(second.changed).toBe(false);
    expect(repo.changesForMint(MINT_A)).toHaveLength(0);
  });

  it("persists consensus confidence + runs when supplied", () => {
    const input = mkInput(MINT_A, "halal");
    const r = repo.persist({
      ...input,
      consensus: { confidence: 0.86, runs: 3 },
    });
    const row = repo.latestForMint(MINT_A);
    expect(row?.consensusConfidence).toBeCloseTo(0.86, 5);
    expect(row?.consensusRuns).toBe(3);
    expect(r.id).toBeGreaterThan(0);
  });
});

describe("computeDiff", () => {
  it("flags verdict label change", () => {
    const a = mkVerdict(MINT_A, "halal");
    const b = mkVerdict(MINT_A, "haram");
    const d = computeDiff(a, b);
    expect(d.verdictChanged).toBe(true);
    expect(d.previous).toBe("halal");
    expect(d.next).toBe("haram");
  });

  it("identifies outcome deltas per rule id", () => {
    const a = mkVerdict(MINT_A, "halal");
    const b = mkVerdict(MINT_A, "halal", undefined, [
      {
        ruleId: "riba.lending-protocol-interaction",
        ruleVersion: "0.1.0",
        category: "riba",
        material: true,
        outcome: "flag",
        rationale: "x",
        evidence: [],
      },
    ]);
    const d = computeDiff(a, b);
    expect(d.outcomeDeltas).toHaveLength(1);
    expect(d.outcomeDeltas[0]).toEqual({
      ruleId: "riba.lending-protocol-interaction",
      previous: "pass",
      next: "flag",
    });
  });

  it("reports score delta only when |Δ| > 0.01", () => {
    const a = mkVerdict(MINT_A, "halal");
    const b = mkVerdict(MINT_A, "halal");
    b.scoreBreakdown.governance = 0.999;
    const d = computeDiff(a, b);
    expect(d.scoreDeltas).toHaveLength(0);
    b.scoreBreakdown.governance = 0.5;
    const d2 = computeDiff(a, b);
    expect(d2.scoreDeltas.some((s) => s.axis === "governance")).toBe(true);
  });

  it("counts added + removed citations across runs", () => {
    const a = mkVerdict(MINT_A, "halal", undefined, [
      {
        ruleId: "x",
        ruleVersion: "0.1.0",
        category: "riba",
        material: true,
        outcome: "pass",
        rationale: "",
        evidence: [
          {
            type: "document",
            sourceUrl: "https://a.com",
            contentHash: "h1",
            excerpt: "e",
          },
        ],
      },
    ]);
    const b = mkVerdict(MINT_A, "halal", undefined, [
      {
        ruleId: "x",
        ruleVersion: "0.1.0",
        category: "riba",
        material: true,
        outcome: "pass",
        rationale: "",
        evidence: [
          {
            type: "document",
            sourceUrl: "https://b.com",
            contentHash: "h2",
            excerpt: "e",
          },
        ],
      },
    ]);
    const d = computeDiff(a, b);
    expect(d.newCitations).toBe(1);
    expect(d.removedCitations).toBe(1);
  });
});

describe("webhook deliveries persistence", () => {
  it("records and reads deliveries scoped to a webhook", () => {
    const db = openDb({ path: ":memory:" });
    const repo = new VerdictRepository(db);
    repo.recordWebhookDelivery({
      id: "d1",
      webhookId: "w1",
      event: "verdict.computed",
      url: "https://httpbin.org/post",
      timestamp: "2026-05-18T00:00:00Z",
      attempt: 1,
      statusCode: 200,
      latencyMs: 412,
      success: true,
    });
    repo.recordWebhookDelivery({
      id: "d2",
      webhookId: "w1",
      event: "verdict.changed",
      url: "https://httpbin.org/post",
      timestamp: "2026-05-18T01:00:00Z",
      attempt: 2,
      statusCode: 500,
      latencyMs: 700,
      success: false,
      error: "http 500",
    });
    repo.recordWebhookDelivery({
      id: "d3",
      webhookId: "w2",
      event: "verdict.computed",
      url: "https://example.com/x",
      timestamp: "2026-05-18T00:30:00Z",
      attempt: 1,
      statusCode: 200,
      latencyMs: 80,
      success: true,
    });
    const list = repo.listDeliveriesForWebhook("w1");
    expect(list).toHaveLength(2);
    expect(list[0]?.event).toBe("verdict.changed");
    expect(list[0]?.success).toBe(false);
    expect(list[0]?.error).toBe("http 500");
    expect(repo.listDeliveriesForWebhook("w2")).toHaveLength(1);
  });
});
