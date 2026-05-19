"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useAuth } from "./auth-context";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage =
  | "idle"
  | "intent"
  | "sending"
  | "confirming"
  | "verifying"
  | "done"
  | "error";

export function SubscribeModal({ open, onClose }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { user, subscription, refresh } = useAuth();
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setStage("idle");
      setErrorMsg(null);
      setProgressNote("");
    }
  }, [open]);

  const start = useCallback(async () => {
    if (!connected || !publicKey) {
      setStage("error");
      setErrorMsg("connect a wallet first");
      return;
    }
    setStage("intent");
    setErrorMsg(null);
    setProgressNote("Opening subscription intent…");
    try {
      const intentRes = await fetch("/api/subscription/intent", {
        method: "POST",
      });
      const intent = (await intentRes.json()) as {
        intentId?: string;
        lamports?: string;
        sol?: number;
        error?: { message: string };
      };
      if (!intentRes.ok || !intent.intentId || !intent.lamports) {
        throw new Error(intent.error?.message ?? "intent failed");
      }
      const recRes = await fetch("/api/subscription/recipient");
      const rec = (await recRes.json()) as {
        recipient?: string;
        error?: { message: string };
      };
      if (!recRes.ok || !rec.recipient) {
        throw new Error(rec.error?.message ?? "recipient unavailable");
      }
      const lamports = Number(intent.lamports);
      const recipient = new PublicKey(rec.recipient);

      setStage("sending");
      setProgressNote(`Requesting wallet signature for ${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL…`);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipient,
          lamports,
        }),
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection);
      setStage("confirming");
      setProgressNote("Confirming on-chain…");
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      setStage("verifying");
      setProgressNote("Probity is verifying the payment receipt…");
      const verifyRes = await fetch("/api/subscription/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentId: intent.intentId, signature }),
      });
      const verify = (await verifyRes.json()) as {
        subscription?: { expiresAt: string; txSignature: string };
        error?: { message: string };
      };
      if (!verifyRes.ok || !verify.subscription) {
        throw new Error(verify.error?.message ?? "verify failed");
      }
      setStage("done");
      setProgressNote(
        `Activated until ${new Date(verify.subscription.expiresAt).toLocaleDateString()}.`,
      );
      await refresh();
    } catch (e) {
      setStage("error");
      setErrorMsg(e instanceof Error ? e.message : "subscription failed");
    }
  }, [connected, publicKey, connection, sendTransaction, refresh]);

  if (!open) return null;

  const busy =
    stage === "intent" ||
    stage === "sending" ||
    stage === "confirming" ||
    stage === "verifying";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="surface w-full max-w-md p-7"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
            Probity Pro
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        <h2 className="mt-2 text-2xl font-light tracking-tight">
          <span className="font-semibold">0.1 SOL</span>{" "}
          <span className="text-[var(--color-muted)]">/ 30 days</span>
        </h2>
        <ul className="mt-5 space-y-2 text-sm text-[var(--color-muted)]">
          <li>· 5 live screenings per day</li>
          <li>· Full citation trail + audit JSON export</li>
          <li>· Per-mint history + verdict.changed alerts</li>
          <li>· On-chain attested compliance receipts</li>
        </ul>

        <div
          className="mt-6 p-3.5 surface-2 text-xs leading-relaxed text-[var(--color-muted)]"
        >
          Your wallet will display the recipient and amount before signing. The
          transaction is broadcast directly from your wallet to Solana mainnet;
          Probity never holds your funds.
        </div>

        {subscription?.active && (
          <p
            className="mt-4 chip"
            style={{
              color: "var(--color-halal)",
              borderColor: "var(--color-halal-border)",
            }}
          >
            Already active · until{" "}
            {subscription.expiresAt &&
              new Date(subscription.expiresAt).toLocaleDateString()}
          </p>
        )}

        {progressNote && (
          <p className="mt-4 text-xs mono text-[var(--color-muted-2)]">
            {progressNote}
          </p>
        )}
        {stage === "error" && errorMsg && (
          <p
            className="mt-4 text-xs mono"
            style={{ color: "var(--color-haram)" }}
          >
            {errorMsg}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={busy || stage === "done" || !connected || !user}
            className="btn btn-primary flex-1"
          >
            {stage === "done"
              ? "Activated"
              : busy
                ? "Working…"
                : !user
                  ? "Sign in first"
                  : "Subscribe with wallet"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn btn-ghost"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
