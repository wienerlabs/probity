// SPL Token Mint account layout — 82 bytes, little-endian where noted.
//
// offset  size  field
// ─────── ────  ─────────────────────────────────────────────────
//   0      4    mint_authority_option (u32, 0=None, 1=Some)
//   4     32    mint_authority pubkey (raw 32 bytes)
//  36      8    supply (u64 LE)
//  44      1    decimals (u8)
//  45      1    is_initialized (u8)
//  46      4    freeze_authority_option (u32)
//  50     32    freeze_authority pubkey
//
// Reference: spl-token program, state::Mint.

import { base58Encode } from "./base58";

export const MINT_ACCOUNT_SIZE = 82;

export interface ParsedMint {
  mintAuthority: string | null;
  supply: bigint;
  decimals: number;
  isInitialized: boolean;
  freezeAuthority: string | null;
}

export function parseMintAccount(data: Uint8Array): ParsedMint {
  if (data.length < MINT_ACCOUNT_SIZE) {
    throw new Error(
      `mint account data too short: ${data.length} < ${MINT_ACCOUNT_SIZE}`,
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const mintAuthOption = view.getUint32(0, true);
  const mintAuthority =
    mintAuthOption === 0 ? null : base58Encode(data.subarray(4, 36));

  const supply = view.getBigUint64(36, true);
  const decimals = view.getUint8(44);
  const isInitialized = view.getUint8(45) !== 0;

  const freezeAuthOption = view.getUint32(46, true);
  const freezeAuthority =
    freezeAuthOption === 0 ? null : base58Encode(data.subarray(50, 82));

  return {
    mintAuthority,
    supply,
    decimals,
    isInitialized,
    freezeAuthority,
  };
}

export function formatSupply(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toLocaleString("en-US");
  const s = raw.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  const intFormatted = BigInt(int).toLocaleString("en-US");
  return frac.length === 0 ? intFormatted : `${intFormatted}.${frac}`;
}
