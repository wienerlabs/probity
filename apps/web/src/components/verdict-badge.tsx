import type { Verdict } from "@/lib/types";

const META: Record<
  Verdict,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  halal: {
    label: "Halal",
    color: "var(--color-halal)",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.32)",
    description: "Clears every test in the screening framework.",
  },
  mushtabah: {
    label: "Mushtabah",
    color: "var(--color-mushtabah)",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.32)",
    description: "Doubtful — requires deeper human review.",
  },
  haram: {
    label: "Haram",
    color: "var(--color-haram)",
    bg: "rgba(244, 63, 94, 0.08)",
    border: "rgba(244, 63, 94, 0.32)",
    description: "Fails one or more material tests.",
  },
};

export function VerdictBadge({
  verdict,
  size = "md",
  withDot = true,
}: {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  withDot?: boolean;
}) {
  const m = META[verdict];
  const px = size === "lg" ? "px-3 py-1.5" : size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const fs =
    size === "lg" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-2 ${px} ${fs} uppercase tracking-[0.18em] rounded-[2px]`}
      style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}
    >
      {withDot && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: m.color }}
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
