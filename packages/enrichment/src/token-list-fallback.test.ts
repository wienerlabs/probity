import { describe, expect, it } from "vitest";
import { fetchTokenListFallback } from "./token-list-fallback";

const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface Route {
  match: (url: string, init?: RequestInit) => boolean;
  reply: () => Response;
}

function router(routes: Route[]): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    for (const r of routes) {
      if (r.match(url, init)) return r.reply();
    }
    return new Response("not routed", { status: 404 });
  };
}

const JUP_PAYLOAD = [
  {
    id: MINT,
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    isVerified: true,
    twitter: "https://twitter.com/circle",
    website: "https://www.circle.com/en/usdc",
    dev: "5TYZChz7APFopR5QirD5of4rQj1p9AXxeSAg6JndBdGj",
    mintAuthority: "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG",
    freezeAuthority: "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar",
    holderCount: 5_248_202,
    fdv: 8_754_759_883,
    mcap: 8_754_759_883,
    usdPrice: 0.9998,
    liquidity: 436_967_457,
    organicScore: 0.92,
    organicScoreLabel: "high",
    tags: ["stablecoin", "verified"],
    cexes: ["Binance", "Coinbase"],
    audit: {
      mintAuthorityDisabled: false,
      freezeAuthorityDisabled: false,
      topHoldersPercentage: 21.5,
    },
  },
];

const BIRDEYE_PAYLOAD = {
  success: true,
  data: {
    name: "USD Coin",
    symbol: "USDC",
    extensions: {
      description:
        "USDC is a fully collateralized US dollar stablecoin. Reserves are held at regulated financial institutions and US Treasuries; interest accrues to Circle.",
      website: "https://www.circle.com/en/usdc",
      github: "https://github.com/centrehq/centre-tokens",
      coingeckoId: "usd-coin",
    },
    liquidity: 669_458_851,
    price: 0.9998,
  },
};

describe("fetchTokenListFallback", () => {
  it("returns a Jupiter doc when only Jupiter is configured", async () => {
    const fetchImpl = router([
      {
        match: (u) => u.includes("lite-api.jup.ag/tokens/v2/search"),
        reply: () => new Response(JSON.stringify(JUP_PAYLOAD), { status: 200 }),
      },
    ]);
    const out = await fetchTokenListFallback(MINT, { fetchImpl });
    expect(out.documents).toHaveLength(1);
    expect(out.documents[0]?.kind).toBe("tokenomics");
    expect(out.documents[0]?.excerpt).toContain("source: jupiter.v2.search");
    expect(out.documents[0]?.excerpt).toContain("symbol: USDC");
    expect(out.documents[0]?.excerpt).toContain("verified: true");
    expect(out.documents[0]?.excerpt).toContain("tags: stablecoin, verified");
    expect(out.documents[0]?.excerpt).toContain(
      "audit: mint_disabled=false freeze_disabled=false top_holders_pct=21.5",
    );
    expect(out.links.website).toBe("https://www.circle.com/en/usdc");
    expect(out.links.twitter).toBe("https://twitter.com/circle");
  });

  it("composes both Jupiter and Birdeye docs when both are configured", async () => {
    const fetchImpl = router([
      {
        match: (u) => u.includes("lite-api.jup.ag"),
        reply: () => new Response(JSON.stringify(JUP_PAYLOAD), { status: 200 }),
      },
      {
        match: (u) => u.includes("public-api.birdeye.so"),
        reply: () =>
          new Response(JSON.stringify(BIRDEYE_PAYLOAD), { status: 200 }),
      },
    ]);
    const out = await fetchTokenListFallback(MINT, {
      fetchImpl,
      birdeyeApiKey: "bird-key",
    });
    expect(out.documents).toHaveLength(2);
    expect(out.documents[1]?.excerpt).toContain("source: birdeye.token_overview");
    expect(out.documents[1]?.excerpt).toContain(
      "description: USDC is a fully collateralized US dollar stablecoin",
    );
    expect(out.documents[1]?.excerpt).toContain(
      "github: https://github.com/centrehq/centre-tokens",
    );
    expect(out.links.github).toBe("https://github.com/centrehq/centre-tokens");
  });

  it("sends Birdeye API key in the X-API-KEY header", async () => {
    const seen: { url: string; headers?: HeadersInit } = { url: "" };
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.url = String(input);
      seen.headers = init?.headers;
      if (seen.url.includes("lite-api.jup.ag")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify(BIRDEYE_PAYLOAD), { status: 200 });
    };
    await fetchTokenListFallback(MINT, {
      fetchImpl,
      birdeyeApiKey: "secret-key",
    });
    const h = new Headers(seen.headers ?? {});
    expect(h.get("x-api-key")).toBe("secret-key");
    expect(h.get("x-chain")).toBe("solana");
  });

  it("warns when Jupiter returns an empty array", async () => {
    const fetchImpl = router([
      {
        match: (u) => u.includes("lite-api.jup.ag"),
        reply: () => new Response("[]", { status: 200 }),
      },
    ]);
    const out = await fetchTokenListFallback(MINT, { fetchImpl });
    expect(out.documents).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/Jupiter v2 search returned no entry/);
  });

  it("warns and continues when Jupiter 5xx", async () => {
    const fetchImpl = router([
      {
        match: (u) => u.includes("lite-api.jup.ag"),
        reply: () => new Response("upstream down", { status: 503 }),
      },
      {
        match: (u) => u.includes("public-api.birdeye.so"),
        reply: () =>
          new Response(JSON.stringify(BIRDEYE_PAYLOAD), { status: 200 }),
      },
    ]);
    const out = await fetchTokenListFallback(MINT, {
      fetchImpl,
      birdeyeApiKey: "bird-key",
    });
    expect(out.warnings.some((w) => /Jupiter v2.*HTTP 503/.test(w))).toBe(true);
    expect(out.documents.some((d) => d.excerpt.includes("birdeye"))).toBe(true);
  });

  it("rejects oversized bodies cleanly", async () => {
    const huge = JSON.stringify([{ id: MINT, name: "x".repeat(200_000) }]);
    const fetchImpl: typeof fetch = async () =>
      new Response(huge, { status: 200 });
    const out = await fetchTokenListFallback(MINT, {
      fetchImpl,
      maxBytes: 4_096,
    });
    expect(out.documents).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/response body exceeded/);
  });

  it("skips Birdeye entirely when no api key is provided", async () => {
    let birdeyeCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const u = String(input);
      if (u.includes("public-api.birdeye.so")) birdeyeCalls++;
      return new Response(JSON.stringify(JUP_PAYLOAD), { status: 200 });
    };
    await fetchTokenListFallback(MINT, { fetchImpl });
    expect(birdeyeCalls).toBe(0);
  });
});
