import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { badRequest, ok, serverError } from "@/lib/api/responses";
import { isValidBase58Pubkey } from "@/lib/auth/sign-verify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { pubkey?: string } = {};
  try {
    body = (await req.json()) as { pubkey?: string };
  } catch {
    return badRequest("body must be JSON { pubkey }");
  }
  const pubkey = body.pubkey?.trim();
  if (!pubkey || !isValidBase58Pubkey(pubkey)) {
    return badRequest("pubkey must be a base58 Solana public key");
  }
  try {
    const nonce = randomBytes(24).toString("hex");
    await prisma.authNonce.create({
      data: {
        walletPubkey: pubkey,
        nonce,
      },
    });
    return ok({
      nonce,
      message: [
        "Probity — Sign-In With Solana",
        "",
        `Wallet: ${pubkey}`,
        `Nonce: ${nonce}`,
        "",
        "By signing you authenticate with Probity. No fees, no transaction is broadcast.",
      ].join("\n"),
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "nonce issue failed");
  }
}
