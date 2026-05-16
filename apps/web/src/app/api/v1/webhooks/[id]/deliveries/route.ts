import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import { getWebhook } from "@/lib/api/webhook-store";
import { listDeliveries } from "@/lib/api/delivery-log";
import { notFound, ok, unauthorized } from "@/lib/api/responses";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const w = getWebhook(id);
  if (!w || w.owner !== key.owner) return notFound("no webhook with that id");
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 25));
  return ok({
    webhook_id: w.id,
    url: w.url,
    deliveries: listDeliveries(w.id, limit),
  });
}
