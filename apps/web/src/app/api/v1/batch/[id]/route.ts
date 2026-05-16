import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/api-keys";
import { getBatch } from "@/lib/api/batch-store";
import { notFound, ok, unauthorized } from "@/lib/api/responses";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const key = authenticate(req.headers);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const batch = getBatch(id);
  if (!batch) return notFound(`no batch with id "${id}"`);
  if (batch.owner !== key.owner) return notFound(`no batch with id "${id}"`);
  return ok(batch);
}
