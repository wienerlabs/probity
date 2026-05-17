import { NextRequest } from "next/server";
import { check, clientIp, RATE_PUBLIC, RATE_API_KEY } from "@/lib/api/rate-limit";
import { authenticate } from "@/lib/api/api-keys";
import {
  badRequest,
  notFound,
  ok,
  rateLimited,
  serverError,
} from "@/lib/api/responses";
import { resolveVerdict } from "@/lib/api/screening-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ mint: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { mint } = await ctx.params;
  if (!mint) return badRequest("mint path parameter is required");

  const key = authenticate(req.headers);
  const ip = clientIp(req.headers);
  const rate = key
    ? check({ key: `key:${key.id}`, ...RATE_API_KEY })
    : check({ key: `ip:${ip}`, ...RATE_PUBLIC });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  try {
    const decoded = decodeURIComponent(mint);
    const resolved = await resolveVerdict(decoded);
    if (!resolved) return notFound(`no verdict on file for "${decoded}"`);

    const body = {
      mint: resolved.mint,
      source: resolved.source,
      ...(resolved.enrichment_source
        ? { enrichment_source: resolved.enrichment_source }
        : {}),
      verdict: resolved.verdict,
      warnings: resolved.warnings ?? [],
    };
    const headers: Record<string, string> = {
      "x-probity-source": resolved.source,
      ...(resolved.enrichment_source
        ? { "x-probity-enrichment": resolved.enrichment_source }
        : {}),
      "x-ratelimit-remaining": String(rate.remaining),
    };
    return ok(body, { headers });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "unknown error");
  }
}
