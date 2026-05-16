import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import {
  deleteWebhook,
  getWebhook,
} from "@/lib/api/webhook-store";
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
  // Secret is not echoed back; the create response was the only time
  // the plaintext secret was exposed.
  const { secret: _secret, ...safe } = w;
  void _secret;
  return ok(safe);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const ok_ = deleteWebhook(key.owner, id);
  if (!ok_) return notFound("no webhook with that id");
  return new NextResponse(null, { status: 204 });
}
