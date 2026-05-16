import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode } from "./base58";
import {
  parseMintAccount,
  formatSupply,
  MINT_ACCOUNT_SIZE,
} from "./mint-layout";

function makeMintBytes(opts: {
  mintAuthority: string | null;
  supply: bigint;
  decimals: number;
  initialized: boolean;
  freezeAuthority: string | null;
}): Uint8Array {
  const data = new Uint8Array(MINT_ACCOUNT_SIZE);
  const view = new DataView(data.buffer);

  view.setUint32(0, opts.mintAuthority ? 1 : 0, true);
  if (opts.mintAuthority) data.set(base58Decode(opts.mintAuthority), 4);

  view.setBigUint64(36, opts.supply, true);
  view.setUint8(44, opts.decimals);
  view.setUint8(45, opts.initialized ? 1 : 0);

  view.setUint32(46, opts.freezeAuthority ? 1 : 0, true);
  if (opts.freezeAuthority) data.set(base58Decode(opts.freezeAuthority), 50);

  return data;
}

describe("parseMintAccount", () => {
  it("parses an initialized mint with both authorities", () => {
    const mintAuth = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
    const freezeAuth = "So11111111111111111111111111111111111111112";
    const data = makeMintBytes({
      mintAuthority: mintAuth,
      supply: 1_000_000_000_000n,
      decimals: 9,
      initialized: true,
      freezeAuthority: freezeAuth,
    });
    const parsed = parseMintAccount(data);
    expect(parsed.mintAuthority).toBe(mintAuth);
    expect(parsed.freezeAuthority).toBe(freezeAuth);
    expect(parsed.supply).toBe(1_000_000_000_000n);
    expect(parsed.decimals).toBe(9);
    expect(parsed.isInitialized).toBe(true);
  });

  it("parses a mint with renounced authorities", () => {
    const data = makeMintBytes({
      mintAuthority: null,
      supply: 250_000_000n * 1_000_000n,
      decimals: 6,
      initialized: true,
      freezeAuthority: null,
    });
    const parsed = parseMintAccount(data);
    expect(parsed.mintAuthority).toBeNull();
    expect(parsed.freezeAuthority).toBeNull();
    expect(parsed.decimals).toBe(6);
  });

  it("rejects undersized buffers", () => {
    expect(() => parseMintAccount(new Uint8Array(10))).toThrow(/too short/);
  });

  it("decodes/encodes pubkeys symmetrically across the parser", () => {
    const mintAuth = base58Encode(new Uint8Array(32).fill(7));
    const data = makeMintBytes({
      mintAuthority: mintAuth,
      supply: 0n,
      decimals: 0,
      initialized: true,
      freezeAuthority: null,
    });
    expect(parseMintAccount(data).mintAuthority).toBe(mintAuth);
  });
});

describe("formatSupply", () => {
  it("formats whole-number supply with thousands separators", () => {
    expect(formatSupply(1_000_000_000n, 0)).toBe("1,000,000,000");
  });

  it("trims trailing zeros in fractional part", () => {
    // 1.5 with decimals=9 → raw 1_500_000_000
    expect(formatSupply(1_500_000_000n, 9)).toBe("1.5");
  });

  it("preserves significant fractional digits", () => {
    expect(formatSupply(1_234_500n, 6)).toBe("1.2345");
  });

  it("handles zero raw supply", () => {
    expect(formatSupply(0n, 6)).toBe("0");
  });
});
