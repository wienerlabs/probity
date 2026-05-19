import { currentUser } from "@/lib/auth/session";
import { ok } from "@/lib/api/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return ok({ authenticated: false });
  const sub = u.subscriptions[0];
  const expires = sub?.expiresAt ?? null;
  const active =
    !!sub && expires !== null && expires.getTime() > Date.now() && sub.active;
  return ok({
    authenticated: true,
    user: {
      id: u.id,
      walletPubkey: u.walletPubkey,
      displayHandle: u.displayHandle,
      createdAt: u.createdAt.toISOString(),
    },
    subscription: active
      ? {
          active: true,
          expiresAt: expires!.toISOString(),
          paidAt: sub!.paidAt.toISOString(),
          txSignature: sub!.txSignature,
        }
      : { active: false },
  });
}
