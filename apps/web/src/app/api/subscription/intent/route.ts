import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth/session";
import {
  ok,
  rateLimited,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { check, clientIp } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db";
import {
  subscriptionLamports,
  subscriptionRecipient,
} from "@/lib/subscription/recipient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized("wallet not authenticated");

  const rate = check({
    key: `sub:intent:${user.id}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  const ipRate = check({
    key: `sub:intent:ip:${clientIp(req.headers)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipRate.allowed) return rateLimited(ipRate.retryAfterSeconds);

  try {
    const reference = randomBytes(32).toString("hex");
    const intent = await prisma.paymentIntent.create({
      data: {
        userId: user.id,
        expectedRecipient: subscriptionRecipient(),
        expectedLamports: subscriptionLamports().toString(),
        reference,
      },
    });
    return ok({
      intentId: intent.id,
      reference,
      lamports: intent.expectedLamports,
      sol: Number(intent.expectedLamports) / 1_000_000_000,
    });
  } catch (e) {
    console.error("[subscription/intent]", e);
    return serverError("intent failed");
  }
}
