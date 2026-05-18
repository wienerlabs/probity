import { describe, expect, it } from "vitest";
import { base58Decode } from "./base58";
import {
  ACCOUNT_TYPE_MINT,
  ACCOUNT_TYPE_OFFSET,
  BASE_MINT_SIZE,
  hasConfidentialTransfer,
  hasInterestBearing,
  hasNonTransferable,
  hasPermanentDelegate,
  hasTransferFee,
  parseToken2022Mint,
  summarizeExtensions,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_LEGACY_PROGRAM_ID,
} from "./token-2022-layout";

function writePubkeyOption(
  buf: Uint8Array,
  optOffset: number,
  pubkeyOffset: number,
  pubkey: string | null,
): void {
  const view = new DataView(buf.buffer);
  if (!pubkey) {
    view.setUint32(optOffset, 0, true);
    return;
  }
  view.setUint32(optOffset, 1, true);
  buf.set(base58Decode(pubkey), pubkeyOffset);
}

function buildToken2022Body(opts: {
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  supply?: bigint;
  decimals?: number;
  extensions?: Array<{ typeId: number; body: number[] }>;
}): Uint8Array {
  const exts = opts.extensions ?? [];
  const extBytes = exts.reduce((a, e) => a + 4 + e.body.length, 0);
  const total = ACCOUNT_TYPE_OFFSET + 1 + extBytes;
  const data = new Uint8Array(total);
  const view = new DataView(data.buffer);

  writePubkeyOption(data, 0, 4, opts.mintAuthority ?? null);
  view.setBigUint64(36, opts.supply ?? 0n, true);
  view.setUint8(44, opts.decimals ?? 6);
  view.setUint8(45, 1);
  writePubkeyOption(data, 46, 50, opts.freezeAuthority ?? null);

  // padding 82..164 already zero
  data[ACCOUNT_TYPE_OFFSET] = ACCOUNT_TYPE_MINT;

  let cursor = ACCOUNT_TYPE_OFFSET + 1;
  for (const e of exts) {
    view.setUint16(cursor, e.typeId, true);
    view.setUint16(cursor + 2, e.body.length, true);
    data.set(e.body, cursor + 4);
    cursor += 4 + e.body.length;
  }
  return data;
}

describe("parseToken2022Mint", () => {
  it("parses a bare Token-2022 mint with no extensions", () => {
    const data = buildToken2022Body({
      mintAuthority: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      supply: 1_000_000n,
      decimals: 9,
      freezeAuthority: null,
    });
    expect(data.length).toBeGreaterThanOrEqual(BASE_MINT_SIZE);
    const out = parseToken2022Mint(data);
    expect(out.isToken2022).toBe(true);
    expect(out.decimals).toBe(9);
    expect(out.mintAuthority).toBe("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
    expect(out.freezeAuthority).toBeNull();
    expect(out.extensions).toEqual([]);
  });

  it("parses an InterestBearingConfig extension and reports the rate", () => {
    const body = new Uint8Array(56);
    const v = new DataView(body.buffer);
    v.setUint32(0, 0, true); // rate authority None
    v.setBigInt64(36, 1_700_000_000n, true); // init ts
    v.setInt16(44, 250, true); // pre rate
    v.setBigInt64(46, 1_710_000_000n, true); // last ts
    v.setInt16(54, 500, true); // current rate
    const data = buildToken2022Body({
      extensions: [{ typeId: 10, body: Array.from(body) }],
    });
    const out = parseToken2022Mint(data);
    expect(out.extensions).toHaveLength(1);
    const ib = hasInterestBearing(out.extensions);
    expect(ib).not.toBeNull();
    expect(ib!.currentRate).toBe(500);
    expect(ib!.preUpdateAverageRate).toBe(250);
  });

  it("parses a TransferFeeConfig and surfaces the active bps", () => {
    const body = new Uint8Array(116);
    const v = new DataView(body.buffer);
    v.setUint32(0, 0, true);
    v.setUint32(36, 0, true);
    v.setBigUint64(72, 0n, true); // withheld
    v.setBigUint64(80, 100n, true); // older epoch
    v.setBigUint64(88, 1_000_000n, true);
    v.setUint16(96, 150, true); // older bps
    v.setBigUint64(98, 200n, true); // newer epoch
    v.setBigUint64(106, 2_000_000n, true);
    v.setUint16(114, 200, true); // newer bps
    const data = buildToken2022Body({
      extensions: [{ typeId: 1, body: Array.from(body) }],
    });
    const out = parseToken2022Mint(data);
    const fee = hasTransferFee(out.extensions);
    expect(fee).not.toBeNull();
    expect(fee!.newerTransferFee.transferFeeBasisPoints).toBe(200);
    expect(fee!.olderTransferFee.transferFeeBasisPoints).toBe(150);
  });

  it("parses a PermanentDelegate with a present pubkey", () => {
    const delegate = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
    const body = new Uint8Array(32);
    body.set(base58Decode(delegate), 0);
    const data = buildToken2022Body({
      extensions: [{ typeId: 12, body: Array.from(body) }],
    });
    const out = parseToken2022Mint(data);
    const pd = hasPermanentDelegate(out.extensions);
    expect(pd).not.toBeNull();
    expect(pd!.delegate).toBe(delegate);
  });

  it("detects NonTransferable as a flag-only marker extension", () => {
    const data = buildToken2022Body({
      extensions: [{ typeId: 9, body: [] }],
    });
    const out = parseToken2022Mint(data);
    expect(hasNonTransferable(out.extensions)).toBe(true);
  });

  it("detects ConfidentialTransferMint with auditor pubkey", () => {
    const auth = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
    const auditor = "So11111111111111111111111111111111111111112";
    const body = new Uint8Array(65);
    body.set(base58Decode(auth), 0);
    body[32] = 1; // autoApprove
    body.set(base58Decode(auditor), 33);
    const data = buildToken2022Body({
      extensions: [{ typeId: 4, body: Array.from(body) }],
    });
    const ct = hasConfidentialTransfer(parseToken2022Mint(data).extensions);
    expect(ct).not.toBeNull();
    expect(ct!.autoApproveNewAccounts).toBe(true);
    expect(ct!.auditorElgamalPubkey).toBe(auditor);
  });

  it("parses multiple extensions and stops cleanly at end of buffer", () => {
    const data = buildToken2022Body({
      extensions: [
        { typeId: 9, body: [] }, // NonTransferable
        { typeId: 12, body: Array.from(new Uint8Array(32).fill(0xff)) }, // PermanentDelegate
        { typeId: 18, body: Array.from(new Uint8Array(64).fill(0xab)) }, // MetadataPointer
      ],
    });
    const out = parseToken2022Mint(data);
    expect(out.extensions.length).toBe(3);
    const summary = summarizeExtensions(out.extensions);
    expect(summary).toEqual([
      "NonTransferable",
      "PermanentDelegate",
      "MetadataPointer",
    ]);
  });

  it("rejects undersized buffers", () => {
    expect(() => parseToken2022Mint(new Uint8Array(10))).toThrow(/too short/);
  });

  it("exposes the canonical Token-2022 + legacy program IDs", () => {
    expect(TOKEN_2022_PROGRAM_ID).toBe(
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    );
    expect(TOKEN_LEGACY_PROGRAM_ID).toBe(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    );
  });
});
