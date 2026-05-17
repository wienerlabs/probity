import { describe, expect, it } from "vitest";
import { aggregate, fetchProgramInteractions } from "./fetch-program-interactions";
import { HeliusEnhancedClient, type EnhancedTransaction } from "./helius-enhanced";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const SYSTEM = "11111111111111111111111111111111";
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const SOLEND = "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo";

function tx(programs: string[][]): EnhancedTransaction {
  return {
    signature: "sig",
    slot: 1,
    timestamp: 0,
    instructions: programs.map((arr) => ({
      programId: arr[0]!,
      innerInstructions: arr.slice(1).map((p) => ({ programId: p })),
    })),
  };
}

describe("aggregate (pure)", () => {
  it("strips noise programs (Token, ComputeBudget, System) from totals", () => {
    const out = aggregate(
      [tx([[COMPUTE_BUDGET], [TOKEN_PROGRAM], [SYSTEM], [JUPITER]])],
      10,
    );
    expect(out.interactions).toHaveLength(1);
    expect(out.interactions[0]?.program).toBe(JUPITER);
    expect(out.interactions[0]?.kind).toBe("amm-swap");
    expect(out.interactions[0]?.primaryRevenueShare).toBe(1);
    expect(out.scannedHits).toBe(1);
  });

  it("normalises revenue share by frequency across meaningful programs", () => {
    const out = aggregate(
      [
        tx([[JUPITER]]),
        tx([[JUPITER]]),
        tx([[JUPITER]]),
        tx([[SOLEND]]),
      ],
      10,
    );
    expect(out.interactions[0]?.program).toBe(JUPITER);
    expect(out.interactions[0]?.primaryRevenueShare).toBeCloseTo(0.75, 5);
    expect(out.interactions[1]?.program).toBe(SOLEND);
    expect(out.interactions[1]?.primaryRevenueShare).toBeCloseTo(0.25, 5);
    expect(out.interactions[1]?.kind).toBe("lending-interest-bearing");
  });

  it("counts inner instructions (CPI calls) just like top-level ones", () => {
    const out = aggregate(
      [tx([[JUPITER, SOLEND, SOLEND]])], // 1 top + 2 inner = 3 hits
      10,
    );
    expect(out.scannedHits).toBe(3);
    // descending: SOLEND has 2 hits, JUPITER has 1
    expect(out.interactions[0]?.program).toBe(SOLEND);
    expect(out.interactions[0]?.primaryRevenueShare).toBeCloseTo(2 / 3, 5);
    expect(out.interactions[1]?.program).toBe(JUPITER);
    expect(out.interactions[1]?.primaryRevenueShare).toBeCloseTo(1 / 3, 5);
  });

  it("skips failed transactions entirely", () => {
    const ok = tx([[JUPITER]]);
    const bad = { ...tx([[SOLEND]]), transactionError: "InsufficientFunds" };
    const out = aggregate([ok, bad as EnhancedTransaction], 10);
    expect(out.interactions).toHaveLength(1);
    expect(out.interactions[0]?.program).toBe(JUPITER);
  });

  it("surfaces unknown programs in unknownPrograms and tags them 'other'", () => {
    const unknown = "ZZUnknownPr0gram1d1111111111111111111111111";
    const out = aggregate([tx([[unknown]])], 10);
    expect(out.unknownPrograms).toEqual([unknown]);
    expect(out.interactions[0]?.kind).toBe("other");
  });

  it("respects topK by descending hit count", () => {
    const a = "A_PROG__________________________________1234567";
    const b = "B_PROG__________________________________1234567";
    const c = "C_PROG__________________________________1234567";
    const out = aggregate(
      [
        tx([[a], [a], [a]]),
        tx([[b], [b]]),
        tx([[c]]),
      ],
      2,
    );
    expect(out.interactions.map((i) => i.program)).toEqual([a, b]);
  });

  it("returns zero shares when scan is empty", () => {
    const out = aggregate([], 10);
    expect(out.interactions).toHaveLength(0);
    expect(out.scannedHits).toBe(0);
  });
});

describe("fetchProgramInteractions (with mock transport)", () => {
  it("issues a GET against /addresses/{mint}/transactions and parses the result", async () => {
    let capturedUrl = "";
    const fetchImpl: typeof fetch = async (input) => {
      capturedUrl = String(input);
      const body: EnhancedTransaction[] = [
        tx([[JUPITER]]),
        tx([[JUPITER], [SOLEND]]),
      ];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = new HeliusEnhancedClient({ apiKey: "test", fetchImpl });
    const out = await fetchProgramInteractions(client, "MintMint1234", {
      sampleSize: 25,
    });
    expect(capturedUrl).toContain(
      "/addresses/MintMint1234/transactions?api-key=test&limit=25",
    );
    expect(out.scannedTransactions).toBe(2);
    expect(out.interactions[0]?.program).toBe(JUPITER);
    expect(out.interactions[1]?.program).toBe(SOLEND);
  });

  it("surfaces non-200 responses as errors", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("rate limited", { status: 429 });
    const client = new HeliusEnhancedClient({ apiKey: "test", fetchImpl });
    await expect(
      fetchProgramInteractions(client, "MintMint1234"),
    ).rejects.toThrow(/Helius enhanced HTTP 429/);
  });

  it("rejects an unexpected response shape", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "bad token" }), { status: 200 });
    const client = new HeliusEnhancedClient({ apiKey: "test", fetchImpl });
    await expect(
      fetchProgramInteractions(client, "MintMint1234"),
    ).rejects.toThrow(/unexpected response shape/);
  });
});
