import { NextRequest } from "next/server";
import { check, clientIp, RATE_PUBLIC, RATE_API_KEY } from "@/lib/api/rate-limit";
import { authenticate } from "@/lib/api/api-keys";
import { badRequest, ok, rateLimited, serverError } from "@/lib/api/responses";
import { getChanges, getHistory } from "@/lib/screening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ mint: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { mint } = await ctx.params;
  if (!mint) return badRequest("mint path parameter is required");
  const decoded = decodeURIComponent(mint);

  const key = authenticate(req.headers);
  const ip = clientIp(req.headers);
  const rate = key
    ? check({ key: `key:${key.id}:hist`, ...RATE_API_KEY })
    : check({ key: `ip:${ip}:hist`, ...RATE_PUBLIC });
  if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 25)));

  try {
    const history = getHistory(decoded, limit).map((e) => ({
      verdict: e.verdict,
      enrichment_source: e.enrichmentSource,
      evidence: e.evidence,
      computed_at: e.verdict.computedAt,
      expires_at: e.verdict.expiresAt,
      consensus_confidence: e.consensus?.confidence ?? null,
    }));
    const changes = getChanges(decoded, limit);
    return ok({
      mint: decoded,
      history,
      changes,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "unknown error");
  }
}
