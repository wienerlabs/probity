import nacl from "tweetnacl";
import bs58 from "bs58";

const NONCE_TTL_MS = 5 * 60 * 1000;

export function buildSignMessage(nonce: string, pubkey: string): string {
  return [
    "Probity — Sign-In With Solana",
    "",
    `Wallet: ${pubkey}`,
    `Nonce: ${nonce}`,
    "",
    "By signing you authenticate with Probity. No fees, no transaction is broadcast.",
  ].join("\n");
}

export function verifySignature(
  message: string,
  signatureBase58: string,
  pubkeyBase58: string,
): boolean {
  try {
    const msg = new TextEncoder().encode(message);
    const sig = bs58.decode(signatureBase58);
    const pk = bs58.decode(pubkeyBase58);
    if (pk.length !== 32 || sig.length !== 64) return false;
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}

export function isFreshNonce(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() < NONCE_TTL_MS;
}

export function isValidBase58Pubkey(value: string): boolean {
  if (typeof value !== "string" || value.length < 32 || value.length > 44)
    return false;
  try {
    const bytes = bs58.decode(value);
    return bytes.length === 32;
  } catch {
    return false;
  }
}
