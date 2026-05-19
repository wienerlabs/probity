import { ok, unauthorized } from "@/lib/api/responses";
import { currentUser } from "@/lib/auth/session";
import {
  subscriptionLamports,
  subscriptionRecipient,
} from "@/lib/subscription/recipient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized("wallet not authenticated");
  return ok({
    recipient: subscriptionRecipient(),
    lamports: subscriptionLamports().toString(),
    sol: Number(subscriptionLamports()) / 1_000_000_000,
  });
}
