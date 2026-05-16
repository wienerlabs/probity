import { describe, expect, it } from "vitest";
import { screen } from "./screen";
import {
  utilityHalal,
  lendingHaram,
  stablecoinMushtabah,
  FIXED_NOW,
} from "./fixtures";
import { hashEvidence } from "./hash";
import { aggregateVerdict, computeScoreBreakdown } from "./aggregate";

describe("engine.screen — golden verdicts", () => {
  it("utility token → halal, all material rules pass", async () => {
    const v = await screen(utilityHalal);
    expect(v.verdict).toBe("halal");
    expect(v.ruleVersion).toBe("0.1.0");
    expect(v.outcomes.find((o) => o.category === "riba")?.outcome).toBe("pass");
    expect(v.outcomes.find((o) => o.category === "haram-sector")?.outcome).toBe(
      "pass",
    );
    expect(v.outcomes.find((o) => o.category === "maysir")?.outcome).toBe(
      "pass",
    );
  });

  it("lending token → haram via riba material fail", async () => {
    const v = await screen(lendingHaram);
    expect(v.verdict).toBe("haram");
    const riba = v.outcomes.find((o) => o.category === "riba");
    expect(riba?.outcome).toBe("fail");
    expect(riba?.material).toBe(true);
  });

  it("stablecoin → mushtabah via material haram-sector flag (T-bill exposure below threshold)", async () => {
    const v = await screen(stablecoinMushtabah);
    expect(v.verdict).toBe("mushtabah");
    const sector = v.outcomes.find((o) => o.category === "haram-sector");
    expect(sector?.outcome).toBe("flag");
    expect(sector?.material).toBe(true);
    // Governance is non-material and adds context but does not drive the verdict.
    const gov = v.outcomes.find((o) => o.category === "governance");
    expect(gov?.outcome).toBe("flag");
  });
});

describe("engine determinism", () => {
  it("same input twice → byte-identical evidence hash", async () => {
    const a = await screen(utilityHalal);
    const b = await screen(utilityHalal);
    expect(a.evidenceHash).toBe(b.evidenceHash);
    expect(a.computedAt).toBe(b.computedAt); // FIXED_NOW pinned in fixture
    expect(a.evidenceHash.startsWith("sha256:")).toBe(true);
  });

  it("expiry follows now() + 30d", async () => {
    const v = await screen(utilityHalal);
    const computed = new Date(v.computedAt).getTime();
    const expires = new Date(v.expiresAt).getTime();
    expect(expires - computed).toBe(30 * 86_400_000);
    expect(v.computedAt).toBe(FIXED_NOW.toISOString());
  });
});

describe("aggregateVerdict — boundary logic", () => {
  it("any material fail → haram, regardless of other outcomes", () => {
    expect(
      aggregateVerdict([
        {
          ruleId: "x",
          ruleVersion: "0.1.0",
          category: "riba",
          material: true,
          outcome: "fail",
          rationale: "",
          evidence: [],
        },
        {
          ruleId: "y",
          ruleVersion: "0.1.0",
          category: "governance",
          material: false,
          outcome: "pass",
          rationale: "",
          evidence: [],
        },
      ]),
    ).toBe("haram");
  });

  it("non-material fail → mushtabah", () => {
    expect(
      aggregateVerdict([
        {
          ruleId: "x",
          ruleVersion: "0.1.0",
          category: "governance",
          material: false,
          outcome: "fail",
          rationale: "",
          evidence: [],
        },
      ]),
    ).toBe("mushtabah");
  });

  it("all passes → halal", () => {
    expect(
      aggregateVerdict([
        {
          ruleId: "x",
          ruleVersion: "0.1.0",
          category: "riba",
          material: true,
          outcome: "pass",
          rationale: "",
          evidence: [],
        },
      ]),
    ).toBe("halal");
  });
});

describe("computeScoreBreakdown", () => {
  it("missing categories default to 1.0", () => {
    const s = computeScoreBreakdown([]);
    expect(s.riba).toBe(1);
    expect(s.sector).toBe(1);
    expect(s.governance).toBe(1);
  });

  it("a material fail in riba pulls the riba score to 0", () => {
    const s = computeScoreBreakdown([
      {
        ruleId: "x",
        ruleVersion: "0.1.0",
        category: "riba",
        material: true,
        outcome: "fail",
        rationale: "",
        evidence: [],
      },
    ]);
    expect(s.riba).toBe(0);
  });
});

describe("hashEvidence — canonical hash", () => {
  it("reordering evidence keys does not change the hash", () => {
    // Build the same outcome two ways with different object construction order.
    const a = hashEvidence([
      {
        ruleId: "x",
        ruleVersion: "0.1.0",
        category: "riba",
        material: true,
        outcome: "pass",
        rationale: "ok",
        evidence: [
          {
            type: "onchain",
            account: "A",
            slot: 1,
            field: "f",
            value: "v",
          },
        ],
      },
    ]);
    const b = hashEvidence([
      {
        outcome: "pass",
        material: true,
        category: "riba",
        ruleVersion: "0.1.0",
        ruleId: "x",
        rationale: "ok",
        evidence: [
          {
            value: "v",
            field: "f",
            slot: 1,
            account: "A",
            type: "onchain",
          },
        ],
      } as Parameters<typeof hashEvidence>[0][number],
    ]);
    expect(a).toBe(b);
  });
});
