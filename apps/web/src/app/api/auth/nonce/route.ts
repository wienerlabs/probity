import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  badRequest,
  ok,
  rateLimited,
  serverError,
} from "@/lib/api/responses";
import { check, clientIp } from "@/lib/api/rate-limit";
import { buildSignMessage, isValidBase58Pubkey } from "@/lib/auth/sign-verify";
import { expectedDomain } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 512;

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rate = check({ key: `auth:nonce:${ip}`, limit: 12, windowMs: 60_000 });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest("body too large");
  }
  let body: { pubkey?: string } = {};
  try {
    body = raw ? (JSON.parse(raw) as { pubkey?: string }) : {};
  } catch {
    return badRequest("body must be JSON { pubkey }");
  }
  const pubkey = body.pubkey?.trim();
  if (!pubkey || !isValidBase58Pubkey(pubkey)) {
    return badRequest("pubkey must be a base58 Solana public key");
  }

  try {
    const nonce = randomBytes(24).toString("hex");
    const row = await prisma.authNonce.create({
      data: {
        walletPubkey: pubkey,
        nonce,
      },
    });
    const domain = await expectedDomain();
    const issuedAt = row.createdAt.toISOString();
    const message = buildSignMessage({
      domain,
      pubkey,
      nonce,
      issuedAt,
    });
    return ok({
      nonce,
      issuedAt,
      domain,
      message,
    });
  } catch (e) {
    console.error("[auth/nonce]", e);
    return serverError("nonce issue failed");
  }
}
