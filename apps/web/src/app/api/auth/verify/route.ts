import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  ok,
  rateLimited,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { check, clientIp } from "@/lib/api/rate-limit";
import {
  buildSignMessage,
  isFreshNonce,
  isValidBase58Pubkey,
  isValidBase58Signature,
  verifySignature,
} from "@/lib/auth/sign-verify";
import { expectedDomain, issueSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024;

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rate = check({ key: `auth:verify:${ip}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest("body too large");
  }
  let body: { pubkey?: string; signature?: string; nonce?: string } = {};
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    return badRequest("body must be JSON { pubkey, signature, nonce }");
  }
  const pubkey = body.pubkey?.trim();
  const signature = body.signature?.trim();
  const nonce = body.nonce?.trim();
  if (!pubkey || !signature || !nonce) {
    return badRequest("pubkey, signature, nonce are required");
  }
  if (!isValidBase58Pubkey(pubkey)) {
    return badRequest("pubkey must be a base58 Solana public key");
  }
  if (!isValidBase58Signature(signature)) {
    return badRequest("signature must be a base58 ed25519 signature");
  }
  if (!/^[0-9a-f]{32,128}$/i.test(nonce)) {
    return badRequest("nonce malformed");
  }

  try {
    const row = await prisma.authNonce.findUnique({ where: { nonce } });
    if (!row || row.walletPubkey !== pubkey) {
      return unauthorized("nonce invalid");
    }
    if (row.consumedAt) {
      return unauthorized("nonce already consumed");
    }
    if (!isFreshNonce(row.createdAt)) {
      return unauthorized("nonce expired");
    }

    const domain = await expectedDomain();
    const issuedAt = row.createdAt.toISOString();
    const message = buildSignMessage({ domain, pubkey, nonce, issuedAt });
    if (!verifySignature(message, signature, pubkey)) {
      return unauthorized("signature did not verify");
    }

    const now = new Date();
    const user = await prisma.user.upsert({
      where: { walletPubkey: pubkey },
      create: { walletPubkey: pubkey, lastLoginAt: now },
      update: { lastLoginAt: now },
    });

    const claim = await prisma.authNonce.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: now, userId: user.id },
    });
    if (claim.count === 0) {
      return unauthorized("nonce already consumed");
    }

    const token = await issueSession(user.id, user.walletPubkey);
    await setSessionCookie(token);

    return ok({
      user: {
        id: user.id,
        walletPubkey: user.walletPubkey,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[auth/verify]", e);
    return serverError("verify failed");
  }
}
