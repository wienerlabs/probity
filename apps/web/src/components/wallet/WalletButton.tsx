"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "./auth-context";

function truncate(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

export function WalletButton() {
  const { connected, publicKey, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const { user, subscription, quota, signingIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!(e.target as HTMLElement)?.closest?.("[data-wallet-menu]")) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", close);
      return () => document.removeEventListener("mousedown", close);
    }
  }, [open]);

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="btn btn-ghost text-xs"
      >
        Connect Wallet
      </button>
    );
  }

  const pkText = truncate(publicKey.toBase58());
  const walletIcon = wallet?.adapter.icon;
  const status = signingIn
    ? "signing"
    : user
      ? subscription?.active
        ? "active"
        : "unsubscribed"
      : "connecting";

  const statusColor: Record<string, string> = {
    active: "var(--color-halal)",
    unsubscribed: "var(--color-mushtabah)",
    signing: "var(--color-muted)",
    connecting: "var(--color-muted-2)",
  };

  return (
    <div className="relative" data-wallet-menu>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost flex items-center gap-2 text-xs"
      >
        {walletIcon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={walletIcon}
            alt=""
            width={16}
            height={16}
            style={{ borderRadius: "9999px" }}
          />
        )}
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: statusColor[status] }}
        />
        <span className="mono">{pkText}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 surface p-2 min-w-[14rem] z-40"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {wallet?.adapter.name ?? "wallet"}
          </div>
          <p className="px-2 mono text-xs break-all text-[var(--color-muted)]">
            {publicKey.toBase58()}
          </p>
          <div
            className="my-2"
            style={{ borderTop: "1px solid var(--color-border)" }}
          />
          <Link
            href="/me"
            onClick={() => setOpen(false)}
            className="block px-2 py-1.5 rounded text-sm hover:bg-[var(--color-surface-2)]"
          >
            My profile
            {quota && (
              <span className="ml-2 text-[10px] mono text-[var(--color-muted-2)]">
                {quota.remaining}/{quota.dailyLimit} today
              </span>
            )}
          </Link>
          {subscription?.active ? (
            <p className="px-2 py-1 text-[11px] text-[var(--color-halal)]">
              Pro · until{" "}
              {subscription.expiresAt
                ? new Date(subscription.expiresAt).toLocaleDateString()
                : "—"}
            </p>
          ) : (
            <Link
              href="/me?subscribe=1"
              onClick={() => setOpen(false)}
              className="block px-2 py-1.5 rounded text-sm hover:bg-[var(--color-surface-2)]"
              style={{ color: "var(--color-mushtabah)" }}
            >
              Subscribe to Pro
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await signOut();
              await disconnect();
              setOpen(false);
            }}
            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[var(--color-surface-2)] text-[var(--color-muted)]"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
