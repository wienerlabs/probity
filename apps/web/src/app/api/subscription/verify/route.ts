import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/auth/session";
import {
  badRequest,
  err,
  ok,
  rateLimited,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { check, clientIp } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db";
import {
  subscriptionDays,
  subscriptionLamports,
  subscriptionRecipient,
} from "@/lib/subscription/recipient";
import { isValidBase58Signature } from "@/lib/auth/sign-verify";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024;
const TX_MAX_AGE_SECONDS = Number(
  process.env.PROBITY_SUBSCRIPTION_TX_MAX_AGE_SECONDS ?? 3600,
);

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

interface ParsedTx {
  blockTime: number | null;
  slot: number;
  meta: {
    err: unknown;
    fee: number;
    preBalances: number[];
    postBalances: number[];
  } | null;
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string; signer?: boolean }>;
      instructions: Array<{
        programId?: string;
        program?: string;
        parsed?: {
          type?: string;
          info?: {
            source?: string;
            destination?: string;
            lamports?: number;
          };
        };
      }>;
    };
    signatures: string[];
  };
}

function heliusEndpoint(): string {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

async function fetchTransaction(signature: string): Promise<ParsedTx | null> {
  const res = await fetch(heliusEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as JsonRpcResponse<ParsedTx>;
  if (json.error || !json.result) return null;
  return json.result;
}

interface TransferMatch {
  source: string;
  destination: string;
  lamports: number;
}

function findTransferToRecipient(
  tx: ParsedTx,
  recipient: string,
): TransferMatch | null {
  for (const ix of tx.transaction.message.instructions ?? []) {
    const parsed = ix.parsed;
    if (!parsed) continue;
    if (
      ix.program !== "system" &&
      ix.programId &&
      ix.programId !== "11111111111111111111111111111111"
    )
      continue;
    if (parsed.type !== "transfer") continue;
    const info = parsed.info;
    if (!info) continue;
    if (info.destination === recipient && typeof info.lamports === "number") {
      return {
        source: info.source ?? "",
        destination: info.destination,
        lamports: info.lamports,
      };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized("wallet not authenticated");

  const rate = check({
    key: `sub:verify:${user.id}`,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  const ipRate = check({
    key: `sub:verify:ip:${clientIp(req.headers)}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!ipRate.allowed) return rateLimited(ipRate.retryAfterSeconds);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest("body too large");
  }
  let body: { intentId?: string; signature?: string } = {};
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    return badRequest("body must be JSON { intentId, signature }");
  }
  const intentId = body.intentId?.trim();
  const signature = body.signature?.trim();
  if (!intentId || !signature)
    return badRequest("intentId and signature required");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(intentId)) {
    return badRequest("intentId malformed");
  }
  if (!isValidBase58Signature(signature)) {
    return badRequest("signature must be a base58 ed25519 signature");
  }

  try {
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { consumedBy: true },
    });
    if (!intent || intent.userId !== user.id) {
      return err(404, "intent_not_found", "no payment intent for this user");
    }
    if (intent.consumedBy) {
      return err(409, "intent_already_used", "intent already redeemed");
    }
    const existing = await prisma.subscription.findUnique({
      where: { txSignature: signature },
    });
    if (existing) {
      return err(409, "signature_already_used", "this signature already redeemed");
    }

    const tx = await fetchTransaction(signature);
    if (!tx) return err(404, "tx_not_found", "transaction not yet confirmed");
    if (tx.meta?.err)
      return err(400, "tx_failed", "transaction failed on-chain");

    if (tx.blockTime === null || tx.blockTime === undefined) {
      return err(
        425,
        "tx_unconfirmed",
        "transaction has no blockTime yet — retry in a moment",
      );
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - tx.blockTime;
    if (ageSeconds > TX_MAX_AGE_SECONDS) {
      return err(
        400,
        "tx_too_old",
        "transaction is outside the allowed redemption window",
        { ageSeconds, maxSeconds: TX_MAX_AGE_SECONDS },
      );
    }
    if (ageSeconds < -60) {
      return err(400, "tx_future", "transaction timestamp is in the future");
    }

    const recipient = intent.expectedRecipient || subscriptionRecipient();
    const expected = BigInt(intent.expectedLamports || subscriptionLamports());
    const match = findTransferToRecipient(tx, recipient);
    if (!match) {
      return err(
        400,
        "transfer_missing",
        "no system-transfer to the expected recipient was found in this tx",
      );
    }
    if (BigInt(match.lamports) < expected) {
      return err(
        400,
        "insufficient_amount",
        "transfer amount below subscription price",
        {
          expected: expected.toString(),
          observed: match.lamports.toString(),
        },
      );
    }
    if (match.source !== user.walletPubkey) {
      return err(
        400,
        "wrong_payer",
        "transfer source does not match the authenticated wallet",
      );
    }

    const paidAt = new Date(tx.blockTime * 1000);
    const expiresAt = new Date(
      paidAt.getTime() + subscriptionDays() * 86_400_000,
    );

    try {
      const subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          paymentIntentId: intent.id,
          txSignature: signature,
          payerPubkey: match.source,
          recipientPubkey: recipient,
          lamports: match.lamports.toString(),
          paidAt,
          expiresAt,
          active: true,
        },
      });
      return ok({
        subscription: {
          id: subscription.id,
          active: true,
          paidAt: subscription.paidAt.toISOString(),
          expiresAt: subscription.expiresAt.toISOString(),
          txSignature: subscription.txSignature,
        },
      });
    } catch (createErr) {
      if (
        createErr instanceof Prisma.PrismaClientKnownRequestError &&
        createErr.code === "P2002"
      ) {
        return err(
          409,
          "already_redeemed",
          "intent or signature was just claimed by a parallel request",
        );
      }
      throw createErr;
    }
  } catch (e) {
    console.error("[subscription/verify]", e);
    return serverError("verify failed");
  }
}
