import { describe, expect, it } from "vitest";
import {
  classifyProgram,
  buildProgramInteractions,
  PROGRAM_REGISTRY,
} from "./program-classifier";

describe("classifyProgram", () => {
  it("maps Jupiter v6 to amm-swap", () => {
    const p = classifyProgram("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
    expect(p?.kind).toBe("amm-swap");
    expect(p?.name).toBe("Jupiter v6");
  });

  it("maps Solend to lending-interest-bearing", () => {
    const p = classifyProgram("So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo");
    expect(p?.kind).toBe("lending-interest-bearing");
  });

  it("returns undefined for unknown programs", () => {
    expect(classifyProgram("Unknown111111111111111111111111111111111111")).toBeUndefined();
  });

  it("registry has no duplicate program ids", () => {
    const ids = new Set(PROGRAM_REGISTRY.map((p) => p.id));
    expect(ids.size).toBe(PROGRAM_REGISTRY.length);
  });
});

describe("buildProgramInteractions", () => {
  it("preserves revenue share and falls back to 'other' for unknown programs", () => {
    const out = buildProgramInteractions([
      { programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", primaryRevenueShare: 0.7 },
      { programId: "ZZZunknownProgramId111111111111111111111111", primaryRevenueShare: 0.3 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.kind).toBe("amm-swap");
    expect(out[0]?.primaryRevenueShare).toBe(0.7);
    expect(out[1]?.kind).toBe("other");
  });

  it("flags an interest-bearing lending interaction so downstream rules can fail it", () => {
    const out = buildProgramInteractions([
      { programId: "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo", primaryRevenueShare: 0.6 },
    ]);
    expect(out[0]?.kind).toBe("lending-interest-bearing");
  });
});
