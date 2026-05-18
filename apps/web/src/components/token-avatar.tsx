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

function ipfsToHttps(url: string): string {
  if (url.startsWith("ipfs://")) {
    const cid = url.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://cloudflare-ipfs.com/ipfs/${cid}`;
  }
  if (url.startsWith("ar://")) {
    return `https://arweave.net/${url.slice("ar://".length)}`;
  }
  return url;
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
  const normalized = useMemo(
    () => (logoUrl ? ipfsToHttps(logoUrl.trim()) : null),
    [logoUrl],
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [normalized]);

  const initials = initialsFrom(symbol, name);
  const palette = paletteForMint(mint);
  const ringColor = verdictRingColor(verdictTint);
  const showImage = normalized && !failed;
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
            src={normalized!}
            alt=""
            width={innerSize - padding * 2}
            height={innerSize - padding * 2}
            onError={() => setFailed(true)}
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
