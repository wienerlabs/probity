import { NextRequest } from "next/server";
import { check, clientIp, RATE_PUBLIC, RATE_API_KEY } from "@/lib/api/rate-limit";
import { authenticate } from "@/lib/api/api-keys";
import {
  badRequest,
  err,
  ok,
  rateLimited,
  serverError,
} from "@/lib/api/responses";
import {
  InvalidMintError,
  resolveVerdict,
  ScreeningConfigError,
} from "@/lib/api/screening-runtime";

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

  const useRecentCache = new URL(req.url).searchParams.get("cache") !== "0";

  try {
    const resolved = await resolveVerdict(decodeURIComponent(mint), {
      useRecentCache,
    });
    const body = {
      mint: resolved.mint,
      source: resolved.source,
      enrichment_source: resolved.enrichment_source,
      verdict: resolved.verdict,
      warnings: resolved.warnings ?? [],
      ...(resolved.evidence ? { evidence: resolved.evidence } : {}),
      ...(resolved.documents ? { documents: resolved.documents } : {}),
    };
    return ok(body, {
      headers: {
        "x-probity-source": resolved.source,
        "x-probity-enrichment": resolved.enrichment_source,
        "x-ratelimit-remaining": String(rate.remaining),
      },
    });
  } catch (e) {
    if (e instanceof InvalidMintError) {
      return badRequest(e.message);
    }
    if (e instanceof ScreeningConfigError) {
      return err(503, "screening_unavailable", e.message, {
        missing_env: e.missing,
      });
    }
    return serverError(e instanceof Error ? e.message : "unknown error");
  }
}
