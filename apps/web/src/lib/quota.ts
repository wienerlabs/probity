import { prisma } from "@/lib/db";

const DAILY_LIMIT = Number(process.env.PROBITY_DAILY_VERDICT_LIMIT ?? "5");

export interface QuotaState {
  authenticated: boolean;
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  dailyLimit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

function startOfWindow(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function nextReset(): Date {
  const d = startOfWindow();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function getQuotaForUser(userId: string): Promise<QuotaState> {
  const since = startOfWindow();
  const [used, sub] = await Promise.all([
    prisma.researchEntry.count({
      where: { userId, requestedAt: { gte: since } },
    }),
    prisma.subscription.findFirst({
      where: { userId, active: true, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
    }),
  ]);
  return {
    authenticated: true,
    subscriptionActive: !!sub,
    subscriptionExpiresAt: sub?.expiresAt.toISOString() ?? null,
    dailyLimit: DAILY_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    resetsAt: nextReset().toISOString(),
  };
}

export function emptyQuotaState(): QuotaState {
  return {
    authenticated: false,
    subscriptionActive: false,
    subscriptionExpiresAt: null,
    dailyLimit: DAILY_LIMIT,
    used: 0,
    remaining: 0,
    resetsAt: nextReset().toISOString(),
  };
}

export interface QuotaReservation {
  status: "ok" | "no_subscription" | "exceeded";
  reservationId?: string;
  remainingAfter?: number;
  resetsAt: string;
  dailyLimit: number;
  subscriptionActive: boolean;
}

const PLACEHOLDER_VERDICT = "pending";
const PLACEHOLDER_RULE = "0.0.0";
const PLACEHOLDER_SOURCE = "reservation";
const PLACEHOLDER_EVIDENCE_HASH = "sha256:pending";

// Atomically reserve one screening slot for the user under a Postgres
// transaction-scoped advisory lock. Two concurrent reservations for the same
// user serialize on the same hash, eliminating the count-then-insert race.
export async function reserveQuotaSlot(
  userId: string,
  mint: string,
): Promise<QuotaReservation> {
  const since = startOfWindow();
  const resetsAt = nextReset().toISOString();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      `probity:quota:${userId}`,
    );
    const sub = await tx.subscription.findFirst({
      where: { userId, active: true, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
      select: { id: true },
    });
    if (!sub) {
      return {
        status: "no_subscription" as const,
        resetsAt,
        dailyLimit: DAILY_LIMIT,
        subscriptionActive: false,
      };
    }
    const used = await tx.researchEntry.count({
      where: {
        userId,
        requestedAt: { gte: since },
        verdict: { not: PLACEHOLDER_VERDICT + ":aborted" },
      },
    });
    if (used >= DAILY_LIMIT) {
      return {
        status: "exceeded" as const,
        resetsAt,
        dailyLimit: DAILY_LIMIT,
        subscriptionActive: true,
        remainingAfter: 0,
      };
    }
    const placeholder = await tx.researchEntry.create({
      data: {
        userId,
        mint,
        ruleVersion: PLACEHOLDER_RULE,
        verdict: PLACEHOLDER_VERDICT,
        enrichmentSource: PLACEHOLDER_SOURCE,
        scannedTransactions: 0,
        documentsIngested: 0,
        evidenceHash: PLACEHOLDER_EVIDENCE_HASH,
      },
      select: { id: true },
    });
    return {
      status: "ok" as const,
      reservationId: placeholder.id,
      remainingAfter: Math.max(0, DAILY_LIMIT - used - 1),
      resetsAt,
      dailyLimit: DAILY_LIMIT,
      subscriptionActive: true,
    };
  });
}

export interface FinalizeArgs {
  reservationId: string;
  mint: string;
  ruleVersion: string;
  verdict: string;
  enrichmentSource: string;
  scannedTransactions: number;
  documentsIngested: number;
  consensusConfidence: number | null;
  symbol: string | null;
  name: string | null;
  logoUrl: string | null;
  evidenceHash: string;
}

export async function finalizeQuotaReservation(args: FinalizeArgs): Promise<void> {
  await prisma.researchEntry.update({
    where: { id: args.reservationId },
    data: {
      mint: args.mint,
      ruleVersion: args.ruleVersion,
      verdict: args.verdict,
      enrichmentSource: args.enrichmentSource,
      scannedTransactions: args.scannedTransactions,
      documentsIngested: args.documentsIngested,
      consensusConfidence: args.consensusConfidence,
      symbol: args.symbol,
      name: args.name,
      logoUrl: args.logoUrl,
      evidenceHash: args.evidenceHash,
      requestedAt: new Date(),
    },
  });
}

export async function abortQuotaReservation(reservationId: string): Promise<void> {
  try {
    await prisma.researchEntry.delete({ where: { id: reservationId } });
  } catch {
    /* placeholder already gone — best-effort cleanup */
  }
}

export const DAILY_VERDICT_LIMIT = DAILY_LIMIT;
