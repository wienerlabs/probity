import { describe, expect, it } from "vitest";
import {
  classifyCategoryHints,
  fetchCoingeckoFallback,
} from "./coingecko-fallback";

const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const FULL_PAYLOAD = {
  id: "usd-coin",
  symbol: "usdc",
  name: "USDC",
  description: { en: "USDC is a fully reserved fiat-backed stablecoin issued by Circle." },
  categories: [
    "Stablecoins",
    "Fiat-backed Stablecoin",
    "Solana Ecosystem",
    "Made in USA",
  ],
  platforms: {
    solana: MINT,
    ethereum: "0xa0b8...",
  },
  market_cap_rank: 7,
  community_score: 80.1,
  liquidity_score: 70.5,
  public_interest_score: 90.0,
  links: {
    homepage: ["https://www.circle.com/en/usdc"],
    twitter_screen_name: "circle",
    subreddit_url: "https://reddit.com/r/circle",
    repos_url: { github: ["https://github.com/centrehq/centre-tokens"] },
  },
  market_data: {
    market_cap: { usd: 8_700_000_000 },
    total_volume: { usd: 4_500_000_000 },
    circulating_supply: 8_700_000_000,
    total_supply: 8_700_000_000,
    max_supply: null,
  },
  community_data: { twitter_followers: 1_200_000, reddit_subscribers: 50_000 },
  developer_data: { stars: 600, forks: 120, commit_count_4_weeks: 14 },
};

describe("classifyCategoryHints", () => {
  it("flags gambling/alcohol/weapons categories as haram hints", () => {
    const h = classifyCategoryHints([
      "Gambling",
      "Alcohol Brands",
      "Weapons Manufacturer",
      "Solana Ecosystem",
    ]);
    expect(h.haram).toEqual([
      "Gambling",
      "Alcohol Brands",
      "Weapons Manufacturer",
    ]);
  });

  it("routes infrastructure/oracle/bridge into utility hints", () => {
    const h = classifyCategoryHints([
      "Cross-chain Bridge",
      "Oracle",
      "Layer 1 Infrastructure",
    ]);
    expect(h.utility).toHaveLength(3);
  });

  it("groups DeFi categories separately", () => {
    const h = classifyCategoryHints(["DEX", "Liquid Staking", "Lending"]);
    expect(h.defi.length).toBe(3);
  });

  it("returns three empty buckets for unrecognised categories", () => {
    const h = classifyCategoryHints(["Meme", "Animal"]);
    expect(h.haram).toEqual([]);
    expect(h.utility).toEqual([]);
    expect(h.defi).toEqual([]);
  });
});

describe("fetchCoingeckoFallback", () => {
  it("emits a tokenomics document with categories, description, market data", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(FULL_PAYLOAD), { status: 200 });
    const out = await fetchCoingeckoFallback(MINT, { fetchImpl });
    expect(out.documents).toHaveLength(1);
    const exc = out.documents[0]!.excerpt;
    expect(exc).toContain("source: coingecko.coins.contract");
    expect(exc).toContain("name: USDC");
    expect(exc).toContain("coingecko_id: usd-coin");
    expect(exc).toContain("market_cap_rank: 7");
    expect(exc).toContain("categories:");
    expect(exc).toContain("Fiat-backed Stablecoin");
    expect(exc).toContain("description: USDC is a fully reserved");
    expect(exc).toContain("homepage: https://www.circle.com/en/usdc");
    expect(exc).toContain("github_stars: 600 forks: 120 commits_4w: 14");
    expect(exc).toContain("market_cap_usd: 8700000000");
    expect(out.marketCapRank).toBe(7);
    expect(out.trustScore).toBeCloseTo((80.1 + 70.5 + 90.0) / 3, 4);
    expect(out.links.homepage).toBe("https://www.circle.com/en/usdc");
    expect(out.links.twitter).toBe("https://twitter.com/circle");
    expect(out.links.github).toBe("https://github.com/centrehq/centre-tokens");
    expect(out.categories.length).toBeGreaterThanOrEqual(4);
  });

  it("surfaces 404 as a warning, no document emitted", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("{}", { status: 404 });
    const out = await fetchCoingeckoFallback("UNKNOWN", { fetchImpl });
    expect(out.documents).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/HTTP 404/);
  });

  it("rejects oversized bodies", async () => {
    const huge = "x".repeat(200_000);
    const fetchImpl: typeof fetch = async () =>
      new Response(huge, { status: 200 });
    const out = await fetchCoingeckoFallback(MINT, {
      fetchImpl,
      maxBytes: 4_096,
    });
    expect(out.documents).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/exceeded/);
  });

  it("survives non-JSON body cleanly", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("<html>not json</html>", { status: 200 });
    const out = await fetchCoingeckoFallback(MINT, { fetchImpl });
    expect(out.documents).toHaveLength(0);
    expect(out.warnings.some((w) => /non-JSON/.test(w))).toBe(true);
  });

  it("passes x-cg-demo-api-key when an API key is provided", async () => {
    let seenHeader: string | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      const h = new Headers(init?.headers ?? {});
      seenHeader = h.get("x-cg-demo-api-key");
      return new Response(JSON.stringify({ id: "x", categories: [] }), {
        status: 200,
      });
    };
    await fetchCoingeckoFallback(MINT, { fetchImpl, apiKey: "demo-cg-key" });
    expect(seenHeader).toBe("demo-cg-key");
  });

  it("works for tokens with minimal metadata", async () => {
    const minimal = { id: "x", symbol: "x", name: "X" };
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(minimal), { status: 200 });
    const out = await fetchCoingeckoFallback(MINT, { fetchImpl });
    expect(out.documents).toHaveLength(1);
    expect(out.categories).toEqual([]);
    expect(out.marketCapRank).toBeUndefined();
    expect(out.trustScore).toBeUndefined();
  });
});
