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

export const DAILY_VERDICT_LIMIT = DAILY_LIMIT;
