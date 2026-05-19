import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth/session";
import { ok, serverError, unauthorized } from "@/lib/api/responses";
import { prisma } from "@/lib/db";
import {
  subscriptionLamports,
  subscriptionRecipient,
} from "@/lib/subscription/recipient";

export const runtime = "nodejs";

export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized("wallet not authenticated");

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
    return serverError(e instanceof Error ? e.message : "intent failed");
  }
}
