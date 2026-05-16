import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode, isLikelyBase58Pubkey } from "./base58";

describe("base58", () => {
  it("round-trips 32 random bytes", () => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = (i * 31 + 7) & 0xff;
    const encoded = base58Encode(bytes);
    const decoded = base58Decode(encoded);
    expect(decoded).toEqual(bytes);
  });

  it("encodes 32 zero bytes as 32 ones", () => {
    const bytes = new Uint8Array(32);
    expect(base58Encode(bytes)).toBe("1".repeat(32));
  });

  it("decodes well-known Solana program ids back to 32 bytes", () => {
    const cases = [
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "So11111111111111111111111111111111111111112",
    ];
    for (const id of cases) {
      const bytes = base58Decode(id);
      expect(bytes.length).toBe(32);
      expect(base58Encode(bytes)).toBe(id);
    }
  });

  it("rejects non-alphabet characters", () => {
    expect(() => base58Decode("0OIl")).toThrow();
  });

  it("isLikelyBase58Pubkey accepts well-formed and rejects garbage", () => {
    expect(
      isLikelyBase58Pubkey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
    ).toBe(true);
    expect(isLikelyBase58Pubkey("not a pubkey")).toBe(false);
    expect(isLikelyBase58Pubkey("0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl")).toBe(false);
    expect(isLikelyBase58Pubkey("short")).toBe(false);
  });
});
