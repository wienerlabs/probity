import { currentSession } from "@/lib/auth/session";
import { ok } from "@/lib/api/responses";
import { emptyQuotaState, getQuotaForUser } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sess = await currentSession();
  if (!sess) return ok(emptyQuotaState());
  return ok(await getQuotaForUser(sess.sub));
}
