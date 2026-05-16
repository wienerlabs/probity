import { describe, expect, it } from "vitest";
import { HeliusClient } from "./helius";
import { fetchTokenState } from "./fetch-token-state";
import { base58Decode } from "./base58";
import { MINT_ACCOUNT_SIZE } from "./mint-layout";

function buildMintData(opts: {
  mintAuthority: string | null;
  supply: bigint;
  decimals: number;
  freezeAuthority: string | null;
}): string {
  const data = new Uint8Array(MINT_ACCOUNT_SIZE);
  const view = new DataView(data.buffer);
  view.setUint32(0, opts.mintAuthority ? 1 : 0, true);
  if (opts.mintAuthority) data.set(base58Decode(opts.mintAuthority), 4);
  view.setBigUint64(36, opts.supply, true);
  view.setUint8(44, opts.decimals);
  view.setUint8(45, 1);
  view.setUint32(46, opts.freezeAuthority ? 1 : 0, true);
  if (opts.freezeAuthority) data.set(base58Decode(opts.freezeAuthority), 50);
  return Buffer.from(data).toString("base64");
}

function makeMockFetch(handlers: {
  rpc: (method: string, params: unknown[]) => unknown;
  das?: (method: string, params: unknown) => unknown;
}) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const isDas = body?.method === "getAsset";
    let result: unknown;
    if (isDas) {
      result = handlers.das?.(body.method, body.params) ?? null;
    } else {
      result = handlers.rpc(body.method, body.params);
    }
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: body?.id ?? 1, result }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}

describe("fetchTokenState — orchestration", () => {
  const MINT = "So11111111111111111111111111111111111111112";
  const MINT_AUTH = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

  it("assembles SolanaTokenState from RPC + DAS responses", async () => {
    const fetchImpl = makeMockFetch({
      rpc: (method, params) => {
        if (method === "getAccountInfo") {
          return {
            context: { slot: 318_000_000 },
            value: {
              data: [
                buildMintData({
                  mintAuthority: MINT_AUTH,
                  supply: 1_000_000_000_000n,
                  decimals: 9,
                  freezeAuthority: null,
                }),
                "base64",
              ],
              executable: false,
              lamports: 1,
              owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              rentEpoch: 0,
            },
          };
        }
        if (method === "getTokenLargestAccounts") {
          // total supply 1,000,000,000.000 — share each = 25%
          return {
            context: { slot: 318_000_000 },
            value: [
              { address: "Hldr1", amount: "250000000000", decimals: 9, uiAmount: 250, uiAmountString: "250" },
              { address: "Hldr2", amount: "250000000000", decimals: 9, uiAmount: 250, uiAmountString: "250" },
            ],
          };
        }
        if (method === "getSlot") return 318_000_999;
        throw new Error(`unexpected RPC ${method}`);
      },
      das: () => ({
        id: MINT,
        content: {
          metadata: { name: "Wrapped SOL", symbol: "WSOL" },
          json_uri: "https://example.org/wsol.json",
        },
        authorities: [],
        mutable: false,
        burnt: false,
      }),
    });

    const client = new HeliusClient({ apiKey: "test", fetchImpl });
    const state = await fetchTokenState(client, MINT, {
      programInteractions: [
        { programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", primaryRevenueShare: 0.9 },
      ],
    });

    expect(state.mint).toBe(MINT);
    expect(state.decimals).toBe(9);
    expect(state.supply).toBe("1,000");
    expect(state.mintAuthority).toBe(MINT_AUTH);
    expect(state.freezeAuthority).toBeNull();
    expect(state.metadata.symbol).toBe("WSOL");
    expect(state.metadata.isMutable).toBe(false);
    expect(state.topHolders).toHaveLength(2);
    expect(state.topHolderConcentration).toBeCloseTo(0.5, 4);
    expect(state.programInteractions[0]?.kind).toBe("amm-swap");
    expect(state.snapshotSlot).toBe(318_000_999);
  });

  it("falls back gracefully when DAS getAsset is unavailable", async () => {
    const fetchImpl = makeMockFetch({
      rpc: (method) => {
        if (method === "getAccountInfo") {
          return {
            context: { slot: 1 },
            value: {
              data: [
                buildMintData({
                  mintAuthority: null,
                  supply: 0n,
                  decimals: 6,
                  freezeAuthority: null,
                }),
                "base64",
              ],
              executable: false,
              lamports: 1,
              owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              rentEpoch: 0,
            },
          };
        }
        if (method === "getTokenLargestAccounts") return { context: { slot: 1 }, value: [] };
        if (method === "getSlot") return 1;
        throw new Error("unexpected");
      },
      das: () => {
        throw new Error("DAS unavailable");
      },
    });
    // Override fetch to throw on DAS but succeed on RPC
    const realFetch = fetchImpl;
    const guarded: typeof fetch = async (input, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (body?.method === "getAsset") {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "unavailable" } }),
          { status: 200 },
        );
      }
      return realFetch(input, init);
    };
    const client = new HeliusClient({ apiKey: "test", fetchImpl: guarded });
    const state = await fetchTokenState(client, "Pr0biTy22222222222222222222222222222222UTL2");
    expect(state.metadata.symbol).toBe("");
    expect(state.metadata.isMutable).toBe(true); // default when asset is null
    expect(state.topHolders).toHaveLength(0);
    expect(state.topHolderConcentration).toBe(0);
  });

  it("encodes a stable placeholder metadataAccount", async () => {
    const fetchImpl = makeMockFetch({
      rpc: (method) => {
        if (method === "getAccountInfo") {
          return {
            context: { slot: 1 },
            value: {
              data: [
                buildMintData({
                  mintAuthority: null,
                  supply: 1n,
                  decimals: 0,
                  freezeAuthority: null,
                }),
                "base64",
              ],
              executable: false,
              lamports: 1,
              owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              rentEpoch: 0,
            },
          };
        }
        if (method === "getTokenLargestAccounts") return { context: { slot: 1 }, value: [] };
        if (method === "getSlot") return 1;
        throw new Error("unexpected");
      },
      das: () => ({
        id: "x",
        content: { metadata: {} },
        authorities: [],
        mutable: false,
        burnt: false,
      }),
    });
    const client = new HeliusClient({ apiKey: "test", fetchImpl });
    const mint = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
    const a = await fetchTokenState(client, mint);
    const b = await fetchTokenState(client, mint);
    expect(a.metadataAccount).toBe(b.metadataAccount);
    expect(a.metadataAccount.startsWith("Mta!")).toBe(true);
    // placeholder accepts non-base58 demo mints too (uses string fold)
    const c = await fetchTokenState(client, "Pr0biTy22222222222222222222222222222222UTL2");
    expect(c.metadataAccount.startsWith("Mta!")).toBe(true);
    expect(base58Decode("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4").length).toBe(32);
  });
});
