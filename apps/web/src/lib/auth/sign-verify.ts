import nacl from "tweetnacl";
import bs58 from "bs58";

const NONCE_TTL_MS = 5 * 60 * 1000;

export interface SignMessageContext {
  domain: string;
  pubkey: string;
  nonce: string;
  issuedAt: string;
}

export function buildSignMessage(ctx: SignMessageContext): string {
  return [
    `${ctx.domain} wants you to sign in with your Solana account:`,
    ctx.pubkey,
    "",
    "Probity — sign to authenticate. No fees, no transaction is broadcast.",
    "",
    `Domain: ${ctx.domain}`,
    `Chain: solana:mainnet`,
    `Nonce: ${ctx.nonce}`,
    `Issued At: ${ctx.issuedAt}`,
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

export function isValidBase58Signature(value: string): boolean {
  if (typeof value !== "string" || value.length < 64 || value.length > 120)
    return false;
  try {
    return bs58.decode(value).length === 64;
  } catch {
    return false;
  }
}
