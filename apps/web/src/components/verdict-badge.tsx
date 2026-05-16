import type { Verdict } from "@/lib/types";

const META: Record<
  Verdict,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    glow: string;
    description: string;
  }
> = {
  halal: {
    label: "Halal",
    color: "var(--color-halal)",
    bg: "var(--color-halal-bg)",
    border: "var(--color-halal-border)",
    glow: "var(--color-halal-glow)",
    description: "Clears every test in the screening framework.",
  },
  mushtabah: {
    label: "Mushtabah",
    color: "var(--color-mushtabah)",
    bg: "var(--color-mushtabah-bg)",
    border: "var(--color-mushtabah-border)",
    glow: "var(--color-mushtabah-glow)",
    description: "Doubtful — requires deeper human review.",
  },
  haram: {
    label: "Haram",
    color: "var(--color-haram)",
    bg: "var(--color-haram-bg)",
    border: "var(--color-haram-border)",
    glow: "var(--color-haram-glow)",
    description: "Fails one or more material tests.",
  },
};

export function VerdictBadge({
  verdict,
  size = "md",
  withDot = true,
  glow = false,
}: {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  withDot?: boolean;
  glow?: boolean;
}) {
  const m = META[verdict];
  const px =
    size === "lg" ? "px-4 py-2" : size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5";
  const fs =
    size === "lg" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-2 ${px} ${fs} uppercase tracking-[0.18em] rounded-full font-medium`}
      style={{
        background: m.bg,
        border: `1px solid ${m.border}`,
        color: m.color,
        boxShadow: glow ? m.glow : "none",
      }}
    >
      {withDot && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }}
        />
      )}
      {m.label}
    </span>
  );
}

export function VerdictHeadline({ verdict }: { verdict: Verdict }) {
  const m = META[verdict];
  return (
    <p className="text-sm text-[var(--color-muted)]">
      <span style={{ color: m.color }}>{m.label}</span> — {m.description}
    </p>
  );
}

export function verdictColor(verdict: Verdict): string {
  return META[verdict].color;
}
