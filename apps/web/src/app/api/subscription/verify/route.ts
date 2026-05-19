import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import {
  badRequest,
  err,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db";
import {
  subscriptionDays,
  subscriptionLamports,
  subscriptionRecipient,
} from "@/lib/subscription/recipient";

export const runtime = "nodejs";

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

function findTransferToRecipient(tx: ParsedTx, recipient: string): TransferMatch | null {
  for (const ix of tx.transaction.message.instructions ?? []) {
    const parsed = ix.parsed;
    if (!parsed) continue;
    if (ix.program !== "system" && ix.programId && ix.programId !== "11111111111111111111111111111111")
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

  let body: { intentId?: string; signature?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("body must be JSON { intentId, signature }");
  }
  const intentId = body.intentId?.trim();
  const signature = body.signature?.trim();
  if (!intentId || !signature) return badRequest("intentId and signature required");

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
    if (tx.meta?.err) return err(400, "tx_failed", "transaction failed on-chain");

    const recipient = subscriptionRecipient();
    const expected = subscriptionLamports();
    const match = findTransferToRecipient(tx, recipient);
    if (!match) {
      return err(
        400,
        "transfer_missing",
        "no system-transfer to the expected recipient was found in this tx",
      );
    }
    if (BigInt(match.lamports) < expected) {
      return err(400, "insufficient_amount", "transfer amount below subscription price", {
        expected: expected.toString(),
        observed: match.lamports.toString(),
      });
    }
    if (match.source !== user.walletPubkey) {
      return err(
        400,
        "wrong_payer",
        "transfer source does not match the authenticated wallet",
      );
    }

    const paidAt = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
    const expiresAt = new Date(paidAt.getTime() + subscriptionDays() * 86_400_000);

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
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "verify failed");
  }
}
