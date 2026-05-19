import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { getQuotaForUser } from "@/lib/quota";
import { prisma } from "@/lib/db";
import { VerdictBadge } from "@/components/verdict-badge";
import { TokenAvatar } from "@/components/token-avatar";
import { Gauge, StatCard } from "@/components/charts";
import { formatRelative, truncateMiddle } from "@/lib/format";
import { SubscribeLauncher } from "./subscribe-launcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ subscribe?: string }>;
}

export default async function MePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/");

  const [quota, history, totals] = await Promise.all([
    getQuotaForUser(user.id),
    prisma.researchEntry.findMany({
      where: { userId: user.id },
      orderBy: { requestedAt: "desc" },
      take: 25,
    }),
    prisma.researchEntry.groupBy({
      by: ["verdict"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const totalByVerdict: Record<string, number> = {
    halal: 0,
    mushtabah: 0,
    haram: 0,
  };
  for (const t of totals) totalByVerdict[t.verdict] = t._count._all;
  const totalEntries = Object.values(totalByVerdict).reduce((a, b) => a + b, 0);

  const subscription = user.subscriptions[0];
  const subActive =
    !!subscription &&
    subscription.expiresAt.getTime() > Date.now() &&
    subscription.active;
  const subscribeOpen = sp.subscribe === "1" && !subActive;

  return (
    <div className="container-page py-14 md:py-20">
      <SubscribeLauncher autoOpen={subscribeOpen} />

      <section className="flex flex-wrap items-center gap-4">
        <TokenAvatar
          mint={user.walletPubkey}
          symbol={user.displayHandle ?? "??"}
          name={user.displayHandle ?? null}
          size={64}
          ring
          verdictTint={subActive ? "halal" : "mushtabah"}
        />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
            My profile
          </p>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight mt-1">
            <span className="font-semibold">
              {user.displayHandle ?? truncateMiddle(user.walletPubkey, 6, 6)}
            </span>
          </h1>
          <p className="mono text-xs text-[var(--color-muted)] mt-1 break-all">
            {user.walletPubkey}
          </p>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Subscription"
          value={subActive ? "Pro" : "Free"}
          sub={
            subActive
              ? `until ${subscription!.expiresAt.toLocaleDateString()}`
              : "0.1 SOL / 30 days"
          }
          accent={subActive ? "var(--color-halal)" : "var(--color-mushtabah)"}
        />
        <StatCard
          label="Daily quota"
          value={`${quota.used}/${quota.dailyLimit}`}
          sub={
            subActive
              ? `resets ${formatRelative(quota.resetsAt).replace("ago", "from now")}`
              : "subscribe to enable"
          }
          accent="var(--color-text)"
        />
        <StatCard
          label="Total screenings"
          value={totalEntries.toLocaleString()}
          sub={`H ${totalByVerdict.halal} · M ${totalByVerdict.mushtabah} · X ${totalByVerdict.haram}`}
          accent="var(--color-text)"
        />
        <StatCard
          label="Member since"
          value={user.createdAt.toLocaleDateString()}
          sub={`wallet first seen`}
          accent="var(--color-muted)"
        />
      </section>

      {!subActive && (
        <section
          className="mt-10 surface p-7 flex flex-col md:flex-row gap-6 md:items-center justify-between"
          style={{
            background: "var(--color-mushtabah-bg)",
            borderColor: "var(--color-mushtabah-border)",
          }}
        >
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.2em] mb-2"
              style={{ color: "var(--color-mushtabah)" }}
            >
              Subscribe to start screening
            </p>
            <p className="text-lg text-[var(--color-text)] max-w-xl leading-relaxed">
              You&apos;re signed in but on the free tier. Probity gates live
              screenings behind a 0.1 SOL / 30-day subscription so the
              pipeline can pay for Helius, Claude, and the on-chain attestation
              signer.
            </p>
          </div>
          <SubscribeLauncher inlineButton />
        </section>
      )}

      {subActive && (
        <section className="mt-10 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
          <div className="surface p-6 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] self-start">
              Daily usage
            </p>
            <Gauge
              value={quota.dailyLimit > 0 ? quota.used / quota.dailyLimit : 0}
              size={210}
              label={`${quota.used}/${quota.dailyLimit} today`}
              sub={`resets ${formatRelative(quota.resetsAt).replace(
                "ago",
                "from now",
              )}`}
              thresholds={{ warn: 0.6, bad: 0.85 }}
            />
          </div>
          <div className="surface p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-3">
              Active subscription
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                  Paid at
                </p>
                <p className="mono mt-1">{subscription!.paidAt.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                  Expires
                </p>
                <p className="mono mt-1">{subscription!.expiresAt.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                  Tx signature
                </p>
                <a
                  href={`https://explorer.solana.com/tx/${subscription!.txSignature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-xs text-[var(--color-text)] hover:underline break-all"
                >
                  {subscription!.txSignature}
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-12">
        <header className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-medium">Research history</h2>
          <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {history.length} of {totalEntries}
          </p>
        </header>
        {history.length === 0 ? (
          <div className="surface p-10 text-center">
            <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
              No screenings yet — head to the dashboard and paste a mint
              address.
            </p>
            <Link
              href="/"
              className="btn btn-primary mt-5 inline-block"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="surface-2 p-3.5">
                <Link
                  href={`/verdict/${h.mint}`}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-sm"
                >
                  <TokenAvatar
                    mint={h.mint}
                    logoUrl={h.logoUrl}
                    symbol={h.symbol}
                    name={h.name}
                    size={36}
                    verdictTint={h.verdict as "halal" | "mushtabah" | "haram"}
                    ring
                  />
                  <div className="min-w-0">
                    <p className="text-[var(--color-text)]">
                      <span className="font-medium">
                        {h.symbol || truncateMiddle(h.mint, 6, 6)}
                      </span>
                      {h.name && (
                        <span className="text-[var(--color-muted)] ml-2">
                          {h.name}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] mono text-[var(--color-muted-2)] truncate">
                      {h.evidenceHash.replace("sha256:", "").slice(0, 12)}… ·{" "}
                      {h.scannedTransactions} tx · {h.documentsIngested} docs
                    </p>
                  </div>
                  <VerdictBadge
                    verdict={h.verdict as "halal" | "mushtabah" | "haram"}
                    size="sm"
                  />
                  <span className="text-[var(--color-muted-2)] text-right text-[11px]">
                    {formatRelative(h.requestedAt.toISOString())}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
