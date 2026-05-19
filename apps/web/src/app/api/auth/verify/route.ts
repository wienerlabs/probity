import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api/responses";
import {
  buildSignMessage,
  isFreshNonce,
  isValidBase58Pubkey,
  verifySignature,
} from "@/lib/auth/sign-verify";
import { issueSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { pubkey?: string; signature?: string; nonce?: string } = {};
  try {
    body = (await req.json()) as typeof body;
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

  try {
    const row = await prisma.authNonce.findUnique({ where: { nonce } });
    if (!row || row.walletPubkey !== pubkey || row.consumedAt) {
      return unauthorized("nonce invalid or already consumed");
    }
    if (!isFreshNonce(row.createdAt)) {
      return unauthorized("nonce expired");
    }

    const message = buildSignMessage(nonce, pubkey);
    const ok_ = verifySignature(message, signature, pubkey);
    if (!ok_) return unauthorized("signature did not verify");

    const now = new Date();
    const user = await prisma.user.upsert({
      where: { walletPubkey: pubkey },
      create: { walletPubkey: pubkey, lastLoginAt: now },
      update: { lastLoginAt: now },
    });

    await prisma.authNonce.update({
      where: { id: row.id },
      data: { consumedAt: now, userId: user.id },
    });

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
    return serverError(e instanceof Error ? e.message : "verify failed");
  }
}
