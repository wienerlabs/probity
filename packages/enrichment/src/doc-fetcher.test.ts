import { describe, expect, it } from "vitest";
import type { SolanaTokenState } from "@probity/types";
import { fetchTokenDocuments, htmlToText } from "./doc-fetcher";

function stateWith(uri: string): SolanaTokenState {
  return {
    mint: "MintMint1234",
    decimals: 9,
    supply: "0",
    mintAuthority: null,
    freezeAuthority: null,
    metadata: { name: "Demo", symbol: "DMO", uri, isMutable: false },
    metadataAccount: "",
    topHolderConcentration: 0,
    topHolders: [],
    programInteractions: [],
    snapshotSlot: 1,
  };
}

function jsonResponder(json: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

function multiResponder(
  routes: Array<{ match: (url: string) => boolean; reply: () => Response }>,
): typeof fetch {
  return async (input) => {
    const url = String(input);
    for (const r of routes) {
      if (r.match(url)) return r.reply();
    }
    return new Response("not found", { status: 404 });
  };
}

describe("fetchTokenDocuments — metadata JSON", () => {
  it("flags an absent URI and returns no documents (fallback disabled)", async () => {
    const out = await fetchTokenDocuments(stateWith(""), {
      fetchImpl: jsonResponder({}),
      disableFallback: true,
    });
    expect(out.documents).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/Metadata URI absent/);
  });

  it("rewrites ipfs:// to a public gateway", async () => {
    let seen = "";
    const fetchImpl: typeof fetch = async (input) => {
      seen = String(input);
      return new Response(
        JSON.stringify({ description: "ipfs token" }),
        { status: 200 },
      );
    };
    const out = await fetchTokenDocuments(
      stateWith("ipfs://bafkreitestcid"),
      { fetchImpl, disableFallback: true },
    );
    expect(seen).toContain("https://cloudflare-ipfs.com/ipfs/bafkreitestcid");
    expect(out.documents[0]?.excerpt).toContain("description: ipfs token");
  });

  it("rewrites ar:// to arweave.net", async () => {
    let seen = "";
    const fetchImpl: typeof fetch = async (input) => {
      seen = String(input);
      return new Response(JSON.stringify({ name: "BONK" }), { status: 200 });
    };
    await fetchTokenDocuments(
      stateWith("ar://QPC6FYdUn-3V8ytFNuoCS85S2tHAuiDblh6u3CIZLsw"),
      { fetchImpl, disableFallback: true },
    );
    expect(seen).toBe(
      "https://arweave.net/QPC6FYdUn-3V8ytFNuoCS85S2tHAuiDblh6u3CIZLsw",
    );
  });

  it("includes description + external_url + extensions in the excerpt", async () => {
    const meta = {
      name: "Token",
      symbol: "TOK",
      description: "A demo utility token",
      external_url: "https://demo-token.xyz",
      extensions: { twitter: "https://x.com/demo" },
    };
    const out = await fetchTokenDocuments(
      stateWith("https://example.org/meta.json"),
      {
        fetchImpl: multiResponder([
          {
            match: (u) => u === "https://example.org/meta.json",
            reply: () =>
              new Response(JSON.stringify(meta), {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
          },
          {
            match: (u) => u === "https://demo-token.xyz",
            reply: () =>
              new Response(
                `<html><body><h1>Welcome</h1><p>We aggregate <b>swaps</b>.</p></body></html>`,
                { status: 200, headers: { "content-type": "text/html" } },
              ),
          },
        ]),
        disableFallback: true,
      },
    );
    expect(out.documents).toHaveLength(2);
    expect(out.documents[0]?.kind).toBe("tokenomics");
    expect(out.documents[0]?.excerpt).toContain(
      "description: A demo utility token",
    );
    expect(out.documents[0]?.excerpt).toContain(
      "external_url: https://demo-token.xyz",
    );
    expect(out.documents[1]?.kind).toBe("other");
    expect(out.documents[1]?.url).toBe("https://demo-token.xyz");
    expect(out.documents[1]?.excerpt).toContain("Welcome");
    expect(out.documents[1]?.excerpt.replace(/\s+/g, " ")).toContain(
      "We aggregate swaps",
    );
  });

  it("emits a warning when metadata is reachable but doesn't list a homepage", async () => {
    const out = await fetchTokenDocuments(
      stateWith("https://example.org/meta.json"),
      {
        fetchImpl: jsonResponder({
          description: "lonely token",
        }),
        disableFallback: true,
      },
    );
    expect(out.documents).toHaveLength(1);
    expect(out.warnings.some((w) => w.toLowerCase().includes("homepage"))).toBe(
      true,
    );
  });

  it("surfaces HTTP errors as warnings, no document added", async () => {
    const out = await fetchTokenDocuments(
      stateWith("https://example.org/meta.json"),
      {
        fetchImpl: async () => new Response("server down", { status: 502 }),
        disableFallback: true,
      },
    );
    expect(out.documents).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/Metadata fetch failed.*HTTP 502/);
  });

  it("treats a non-JSON body as raw text and still surfaces it", async () => {
    const out = await fetchTokenDocuments(
      stateWith("https://example.org/meta.json"),
      {
        fetchImpl: async () =>
          new Response("just some plain text", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
        disableFallback: true,
      },
    );
    expect(out.documents).toHaveLength(1);
    expect(out.documents[0]?.excerpt).toContain("plain text");
    expect(out.warnings.some((w) => w.includes("did not parse as JSON"))).toBe(true);
  });

  it("caps body bytes (no 50MB whitepaper allowed)", async () => {
    const huge = "x".repeat(200_000);
    const out = await fetchTokenDocuments(
      stateWith("https://example.org/meta.json"),
      {
        maxBytesPerDoc: 4_096,
        fetchImpl: async () => new Response(huge, { status: 200 }),
        disableFallback: true,
      },
    );
    expect(out.documents).toHaveLength(1);
    expect(out.documents[0]!.excerpt.length).toBeLessThanOrEqual(4_096);
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts, styles, and entities", () => {
    const html =
      `<html><head><style>body{}</style><script>alert(1)</script></head>` +
      `<body><h1>Hi &amp; welcome</h1><p>This&nbsp;is&#39;ok</p></body></html>`;
    expect(htmlToText(html)).toBe("Hi & welcome This is'ok");
  });
});
