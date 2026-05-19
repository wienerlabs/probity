"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

export interface AuthUser {
  id: string;
  walletPubkey: string;
  displayHandle: string | null;
  createdAt: string;
}

export interface SubscriptionState {
  active: boolean;
  expiresAt?: string;
  paidAt?: string;
  txSignature?: string;
}

export interface QuotaState {
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  dailyLimit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface AuthContextValue {
  authReady: boolean;
  user: AuthUser | null;
  subscription: SubscriptionState | null;
  quota: QuotaState | null;
  signingIn: boolean;
  signInError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const signedForRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [meRes, quotaRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/quota", { cache: "no-store" }),
      ]);
      const meJson = (await meRes.json()) as
        | { authenticated: true; user: AuthUser; subscription: SubscriptionState }
        | { authenticated: false };
      const qJson = (await quotaRes.json()) as QuotaState;
      if (meJson.authenticated) {
        setUser(meJson.user);
        setSubscription(meJson.subscription ?? { active: false });
      } else {
        setUser(null);
        setSubscription(null);
      }
      setQuota(qJson);
    } catch {
      setUser(null);
      setSubscription(null);
      setQuota(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      setSignInError("connect a wallet first");
      return;
    }
    const pubkey = wallet.publicKey.toBase58();
    if (signedForRef.current === pubkey) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const nRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pubkey }),
      });
      const nJson = (await nRes.json()) as {
        nonce?: string;
        message?: string;
        error?: { message: string };
      };
      if (!nRes.ok || !nJson.nonce || !nJson.message) {
        throw new Error(nJson.error?.message ?? "nonce issue failed");
      }
      const encoded = new TextEncoder().encode(nJson.message);
      const sigBytes = await wallet.signMessage(encoded);
      const signature = bs58.encode(sigBytes);
      const vRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pubkey,
          signature,
          nonce: nJson.nonce,
        }),
      });
      const vJson = (await vRes.json()) as {
        user?: AuthUser;
        error?: { message: string };
      };
      if (!vRes.ok || !vJson.user) {
        throw new Error(vJson.error?.message ?? "verify failed");
      }
      signedForRef.current = pubkey;
      await refresh();
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : "sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }, [wallet, refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    signedForRef.current = null;
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!wallet.connected) {
      signedForRef.current = null;
      if (user) {
        signOut();
      }
    } else if (wallet.publicKey && !user && !signingIn) {
      signIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected, wallet.publicKey?.toBase58()]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady,
      user,
      subscription,
      quota,
      signingIn,
      signInError,
      signIn,
      signOut,
      refresh,
    }),
    [authReady, user, subscription, quota, signingIn, signInError, signIn, signOut, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
