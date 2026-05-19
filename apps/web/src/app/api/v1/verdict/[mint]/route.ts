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
import {
  abortQuotaReservation,
  DAILY_VERDICT_LIMIT,
  finalizeQuotaReservation,
  reserveQuotaSlot,
} from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ mint: string }>;
}

const MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { mint: rawMint } = await ctx.params;
  const mint = rawMint ? decodeURIComponent(rawMint).trim() : "";
  if (!mint) return badRequest("mint path parameter is required");
  if (!MINT_PATTERN.test(mint)) {
    return badRequest("mint must be a base58 Solana public key");
  }

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

  let reservationId: string | null = null;
  let quotaRemainingAfter = DAILY_VERDICT_LIMIT;
  let quotaResetsAt = "";
  let subActive = !!key;

  if (sess && !key) {
    const reservation = await reserveQuotaSlot(sess.sub, mint);
    quotaResetsAt = reservation.resetsAt;
    subActive = reservation.subscriptionActive;
    if (reservation.status === "no_subscription") {
      return err(
        402,
        "subscription_required",
        "an active Probity subscription is required to screen tokens",
        { subscribe_url: "/me?subscribe=1" },
      );
    }
    if (reservation.status === "exceeded") {
      return err(
        429,
        "daily_quota_exceeded",
        "you've used today's screening quota",
        { resets_at: reservation.resetsAt, daily_limit: reservation.dailyLimit },
      );
    }
    reservationId = reservation.reservationId ?? null;
    quotaRemainingAfter = reservation.remainingAfter ?? 0;
  }

  const useRecentCache = new URL(req.url).searchParams.get("cache") !== "0";

  try {
    const resolved = await resolveVerdict(mint, { useRecentCache });

    if (reservationId) {
      try {
        await finalizeQuotaReservation({
          reservationId,
          mint: resolved.mint,
          ruleVersion: resolved.verdict.ruleVersion,
          verdict: resolved.verdict.verdict,
          enrichmentSource: resolved.enrichment_source,
          scannedTransactions: resolved.evidence?.scannedTransactions ?? 0,
          documentsIngested: resolved.evidence?.documentsIngested ?? 0,
          consensusConfidence: resolved.consensus?.confidence ?? null,
          symbol:
            resolved.verdict.outcomes[0]?.evidence
              .map((e) => (e.type === "onchain" ? e.value : null))
              .find((v): v is string => typeof v === "string" && v.length < 10) ??
            null,
          name: null,
          logoUrl: null,
          evidenceHash: resolved.verdict.evidenceHash,
        });
      } catch (logErr) {
        console.error("[verdict/persist]", logErr);
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
              remaining: quotaRemainingAfter,
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
          ? { "x-probity-quota-remaining": String(quotaRemainingAfter) }
          : {}),
      },
    });
  } catch (e) {
    if (reservationId) await abortQuotaReservation(reservationId);
    if (e instanceof InvalidMintError) {
      return badRequest(e.message);
    }
    if (e instanceof ScreeningConfigError) {
      return err(503, "screening_unavailable", e.message, {
        missing_env: e.missing,
      });
    }
    console.error("[verdict]", e);
    return serverError("screening failed");
  }
}
