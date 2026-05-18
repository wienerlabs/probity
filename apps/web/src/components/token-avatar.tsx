"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  logoUrl?: string | null | undefined;
  symbol?: string | null | undefined;
  name?: string | null | undefined;
  mint: string;
  size?: number | undefined;
  ring?: boolean | undefined;
  verdictTint?: "halal" | "mushtabah" | "haram" | null | undefined;
}

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cf-ipfs.com/ipfs/",
] as const;

function extractIpfsCid(url: string): string | null {
  if (url.startsWith("ipfs://")) {
    return url.slice("ipfs://".length).replace(/^ipfs\//, "");
  }
  const m = url.match(/\/ipfs\/([^/?#]+(?:\/[^?#]*)?)/);
  return m ? m[1] ?? null : null;
}

function buildCandidates(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("ar://")) {
    const id = trimmed.slice("ar://".length);
    return [`https://arweave.net/${id}`, `https://arweave.dev/${id}`];
  }

  const cid = extractIpfsCid(trimmed);
  if (cid) {
    const first = trimmed.startsWith("ipfs://")
      ? `${IPFS_GATEWAYS[0]}${cid}`
      : trimmed;
    const rest = IPFS_GATEWAYS.map((g) => `${g}${cid}`).filter((u) => u !== first);
    return [first, ...rest];
  }

  if (trimmed.startsWith("http://")) {
    return ["https://" + trimmed.slice("http://".length)];
  }
  if (trimmed.startsWith("https://")) {
    return [trimmed];
  }
  return [];
}

function paletteForMint(mint: string): { fg: string; bg: string } {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = (h * 31 + mint.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return {
    bg: `hsl(${hue}, 32%, 18%)`,
    fg: `hsl(${hue}, 70%, 70%)`,
  };
}

function initialsFrom(symbol?: string | null, name?: string | null): string {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (sym && sym.length <= 4) return sym.slice(0, 4);
  const nm = (name ?? "").trim();
  if (nm) {
    const parts = nm.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  if (sym) return sym.slice(0, 2);
  return "??";
}

function verdictRingColor(t: Props["verdictTint"]): string | null {
  if (t === "halal") return "var(--color-halal)";
  if (t === "mushtabah") return "var(--color-mushtabah)";
  if (t === "haram") return "var(--color-haram)";
  return null;
}

export function TokenAvatar({
  logoUrl,
  symbol,
  name,
  mint,
  size = 40,
  ring = false,
  verdictTint = null,
}: Props) {
  const candidates = useMemo(
    () => (logoUrl ? buildCandidates(logoUrl) : []),
    [logoUrl],
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setAttempt(0);
  }, [candidates]);

  const currentSrc = candidates[attempt];
  const exhausted = candidates.length > 0 && attempt >= candidates.length;
  const initials = initialsFrom(symbol, name);
  const palette = paletteForMint(mint);
  const ringColor = verdictRingColor(verdictTint);
  const showImage = !!currentSrc && !exhausted;
  const padding = Math.max(2, Math.round(size * 0.06));
  const innerSize = size - (ring ? 4 : 0);

  const wrapper: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "9999px",
    background: ring && ringColor ? ringColor : "transparent",
    padding: ring ? 2 : 0,
    boxShadow: ringColor
      ? `0 0 12px -2px color-mix(in oklab, ${ringColor} 60%, transparent)`
      : undefined,
    display: "inline-flex",
    flexShrink: 0,
  };
  const inner: React.CSSProperties = {
    width: innerSize,
    height: innerSize,
    borderRadius: "9999px",
    background: showImage ? "var(--color-bg)" : palette.bg,
    border: showImage
      ? "1px solid var(--color-border)"
      : `1px solid color-mix(in oklab, ${palette.fg} 35%, transparent)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  };

  return (
    <span style={wrapper} aria-label={`${symbol ?? name ?? mint} logo`}>
      <span style={inner}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentSrc}
            src={currentSrc}
            alt=""
            width={innerSize - padding * 2}
            height={innerSize - padding * 2}
            onError={() => setAttempt((a) => a + 1)}
            referrerPolicy="no-referrer"
            loading="lazy"
            style={{
              width: innerSize - padding * 2,
              height: innerSize - padding * 2,
              objectFit: "contain",
              borderRadius: "9999px",
            }}
          />
        ) : (
          <span
            className="font-semibold"
            style={{
              color: palette.fg,
              fontSize: Math.max(10, size * 0.38),
              letterSpacing: "0.04em",
            }}
          >
            {initials}
          </span>
        )}
      </span>
    </span>
  );
}
