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
import { currentSession } from "@/lib/auth/session";
import { DAILY_VERDICT_LIMIT, getQuotaForUser } from "@/lib/quota";
import { prisma } from "@/lib/db";

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

  const sess = await currentSession();

  if (!key && !sess) {
    return err(401, "wallet_required", "connect a Solana wallet to screen tokens");
  }

  let userId: string | null = null;
  let subActive = false;
  let quotaRemaining = DAILY_VERDICT_LIMIT;
  let quotaResetsAt = "";
  if (sess) {
    const q = await getQuotaForUser(sess.sub);
    userId = sess.sub;
    subActive = q.subscriptionActive;
    quotaRemaining = q.remaining;
    quotaResetsAt = q.resetsAt;
    if (!key && !q.subscriptionActive) {
      return err(
        402,
        "subscription_required",
        "an active Probity subscription is required to screen tokens",
        { subscribe_url: "/me?subscribe=1" },
      );
    }
    if (!key && q.remaining <= 0) {
      return err(
        429,
        "daily_quota_exceeded",
        "you've used today's screening quota",
        { resets_at: q.resetsAt, daily_limit: q.dailyLimit },
      );
    }
  }

  const useRecentCache = new URL(req.url).searchParams.get("cache") !== "0";

  try {
    const resolved = await resolveVerdict(decodeURIComponent(mint), {
      useRecentCache,
    });

    if (userId) {
      try {
        await prisma.researchEntry.create({
          data: {
            userId,
            mint: resolved.mint,
            ruleVersion: resolved.verdict.ruleVersion,
            verdict: resolved.verdict.verdict,
            enrichmentSource: resolved.enrichment_source,
            scannedTransactions: resolved.evidence?.scannedTransactions ?? 0,
            documentsIngested: resolved.evidence?.documentsIngested ?? 0,
            ...(resolved.consensus
              ? { consensusConfidence: resolved.consensus.confidence }
              : {}),
            symbol:
              resolved.verdict.outcomes[0]?.evidence
                .map((e) => (e.type === "onchain" ? e.value : null))
                .find((v): v is string => typeof v === "string" && v.length < 10) ?? null,
            evidenceHash: resolved.verdict.evidenceHash,
          },
        });
      } catch {
        /* ignore — research log is best-effort */
      }
    }

    const body = {
      mint: resolved.mint,
      source: resolved.source,
      enrichment_source: resolved.enrichment_source,
      verdict: resolved.verdict,
      warnings: resolved.warnings ?? [],
      ...(resolved.evidence ? { evidence: resolved.evidence } : {}),
      ...(resolved.documents ? { documents: resolved.documents } : {}),
      ...(resolved.consensus ? { consensus: resolved.consensus } : {}),
      ...(sess
        ? {
            quota: {
              subscription_active: subActive,
              remaining: Math.max(0, quotaRemaining - 1),
              resets_at: quotaResetsAt,
              daily_limit: DAILY_VERDICT_LIMIT,
            },
          }
        : {}),
    };
    return ok(body, {
      headers: {
        "x-probity-source": resolved.source,
        "x-probity-enrichment": resolved.enrichment_source,
        "x-ratelimit-remaining": String(rate.remaining),
        ...(sess
          ? { "x-probity-quota-remaining": String(Math.max(0, quotaRemaining - 1)) }
          : {}),
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
