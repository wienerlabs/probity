import { describe, expect, it } from "vitest";
import type { EnrichmentBundle } from "@probity/types";
import {
  confidenceLabel,
  enrichWithConsensus,
  summariseConsensus,
} from "./consensus";
import { ClaudeClient } from "./claude";

function bundle(opts: {
  primary?: string;
  exposures?: Array<{ tag: string; share: number }>;
  utility?: number;
  zeroSum?: number;
  timelock?: number | null;
  multisig?: { m: number; n: number } | null;
  freezeSingleKey?: boolean;
}): EnrichmentBundle {
  return {
    audits: [],
    revenueModel: {
      primary: opts.primary ?? "swap-fees",
      exposures: (opts.exposures ?? []).map((e) => ({
        tag: e.tag as EnrichmentBundle["revenueModel"]["exposures"][number]["tag"],
        revenueShare: e.share,
        source: {
          type: "derivation",
          formula: `f(${e.tag})`,
          result: `${e.share}`,
        },
      })),
      zeroSumRevenueShare: opts.zeroSum ?? 0,
      utilityScore: opts.utility ?? 0.8,
    },
    governance: {
      timelockSeconds: opts.timelock ?? null,
      multisigThreshold: opts.multisig ?? null,
      freezeAuthoritySingleKey: opts.freezeSingleKey ?? false,
    },
  };
}

describe("summariseConsensus — agreement, median, stddev", () => {
  it("computes high confidence when all 3 runs converge", () => {
    const runs = [
      bundle({
        primary: "swap-fees",
        exposures: [{ tag: "primary-utility", share: 0.92 }],
        utility: 0.85,
        timelock: 172_800,
        multisig: { m: 4, n: 7 },
      }),
      bundle({
        primary: "swap-fees",
        exposures: [{ tag: "primary-utility", share: 0.9 }],
        utility: 0.83,
        timelock: 172_800,
        multisig: { m: 4, n: 7 },
      }),
      bundle({
        primary: "swap-fees",
        exposures: [{ tag: "primary-utility", share: 0.94 }],
        utility: 0.87,
        timelock: 172_800,
        multisig: { m: 4, n: 7 },
      }),
    ];
    const { bundle: agg, report } = summariseConsensus(runs);
    expect(agg.revenueModel.primary).toBe("swap-fees");
    expect(agg.revenueModel.exposures[0]?.tag).toBe("primary-utility");
    expect(agg.revenueModel.exposures[0]?.revenueShare).toBeCloseTo(0.92, 4);
    expect(report.confidence).toBeGreaterThan(0.85);
    expect(confidenceLabel(report.confidence)).toBe("high");
  });

  it("flags low confidence when primary label diverges", () => {
    const runs = [
      bundle({ primary: "swap-fees", utility: 0.85 }),
      bundle({ primary: "lending-spread", utility: 0.55 }),
      bundle({ primary: "marketplace-fees", utility: 0.75 }),
    ];
    const { report } = summariseConsensus(runs);
    expect(report.primaryAgreement).toBeCloseTo(1 / 3, 4);
    expect(report.confidence).toBeLessThan(0.7);
    expect(report.warnings.some((w) => w.includes("Primary revenue label"))).toBe(
      true,
    );
    expect(confidenceLabel(report.confidence)).toBe("low");
  });

  it("medianises sector exposure shares across runs", () => {
    const runs = [
      bundle({ exposures: [{ tag: "lending-interest", share: 0.4 }] }),
      bundle({ exposures: [{ tag: "lending-interest", share: 0.5 }] }),
      bundle({ exposures: [{ tag: "lending-interest", share: 0.9 }] }),
    ];
    const { bundle: agg, report } = summariseConsensus(runs);
    expect(agg.revenueModel.exposures[0]?.revenueShare).toBeCloseTo(0.5, 4);
    const tagAgreement = report.sectorAgreements.find(
      (a) => a.tag === "lending-interest",
    );
    expect(tagAgreement?.occurrences).toBe(3);
    expect(tagAgreement?.shareMin).toBeCloseTo(0.4, 4);
    expect(tagAgreement?.shareMax).toBeCloseTo(0.9, 4);
  });

  it("modal-votes governance fields and reports agreement ratios", () => {
    const runs = [
      bundle({ timelock: 172_800, freezeSingleKey: false }),
      bundle({ timelock: 172_800, freezeSingleKey: false }),
      bundle({ timelock: null, freezeSingleKey: true }),
    ];
    const { bundle: agg, report } = summariseConsensus(runs);
    expect(agg.governance.timelockSeconds).toBe(172_800);
    expect(agg.governance.freezeAuthoritySingleKey).toBe(false);
    const tl = report.governanceAgreements.find((g) => g.field === "timelockSeconds");
    expect(tl?.agreement).toBeCloseTo(2 / 3, 4);
  });

  it("trims aggregate exposures so the union never exceeds 1.0", () => {
    const runs = [
      bundle({
        exposures: [
          { tag: "lending-interest", share: 0.6 },
          { tag: "conventional-finance", share: 0.6 },
        ],
      }),
      bundle({
        exposures: [
          { tag: "lending-interest", share: 0.7 },
          { tag: "conventional-finance", share: 0.5 },
        ],
      }),
    ];
    const { bundle: agg } = summariseConsensus(runs);
    const sum = agg.revenueModel.exposures.reduce(
      (a, e) => a + e.revenueShare,
      0,
    );
    expect(sum).toBeLessThanOrEqual(1.001);
  });

  it("dedupes audit citations across runs by url+hash", () => {
    const baseAudit = {
      type: "document" as const,
      sourceUrl: "https://example.org/audit.pdf",
      contentHash: "sha256:abc",
      excerpt: "Q1 audit",
    };
    const a = bundle({});
    const b = bundle({});
    a.audits = [baseAudit];
    b.audits = [baseAudit];
    const { bundle: agg } = summariseConsensus([a, b]);
    expect(agg.audits).toHaveLength(1);
  });

  it("rejects empty input", () => {
    expect(() => summariseConsensus([])).toThrow();
  });
});

describe("confidenceLabel", () => {
  it("maps thresholds to high/medium/low", () => {
    expect(confidenceLabel(0.9)).toBe("high");
    expect(confidenceLabel(0.75)).toBe("medium");
    expect(confidenceLabel(0.5)).toBe("low");
  });
});

describe("enrichWithConsensus — full pipeline against mocked Claude", () => {
  it("runs N parallel calls and folds them into a single bundle", async () => {
    const payload = JSON.stringify({
      revenueModel: {
        primary: "swap-fees",
        exposures: [
          {
            tag: "primary-utility",
            revenueShare: 0.9,
            rationale: "swap aggregation fees",
            source_url: null,
          },
        ],
        zeroSumRevenueShare: 0,
        utilityScore: 0.85,
      },
      governance: {
        timelockSeconds: 172_800,
        multisigThreshold: { m: 4, n: 7 },
        freezeAuthoritySingleKey: false,
      },
    });
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls++;
      return new Response(
        JSON.stringify({
          id: "msg",
          model: "claude",
          role: "assistant",
          content: [{ type: "text", text: payload }],
          stop_reason: "end_turn",
        }),
        { status: 200 },
      );
    };
    const client = new ClaudeClient({ apiKey: "k", fetchImpl });
    const out = await enrichWithConsensus(
      {
        state: {
          mint: "M",
          decimals: 9,
          supply: "1",
          mintAuthority: null,
          freezeAuthority: null,
          metadata: { name: "T", symbol: "T", uri: "", isMutable: false },
          metadataAccount: "",
          topHolderConcentration: 0,
          topHolders: [],
          programInteractions: [],
          snapshotSlot: 1,
        },
        documents: [],
      },
      { client, runs: 3 },
    );
    expect(calls).toBe(3);
    expect(out.rawBundles).toHaveLength(3);
    expect(out.bundle.revenueModel.primary).toBe("swap-fees");
    expect(out.report.confidence).toBeGreaterThan(0.85);
  });
});
