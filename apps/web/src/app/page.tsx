import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { VerdictCard } from "@/components/verdict-card";
import { VerdictBadge } from "@/components/verdict-badge";
import { getRecent } from "@/lib/screening";

export const dynamic = "force-dynamic";

const QUICK_EXAMPLES: { mint: string; label: string }[] = [
  { mint: "So11111111111111111111111111111111111111112", label: "wSOL" },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", label: "USDC" },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", label: "JUP" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", label: "BONK" },
];

export default function HomePage() {
  const recent = getRecent();
  const counts = {
    halal: recent.filter((r) => r.verdict.verdict === "halal").length,
    mushtabah: recent.filter((r) => r.verdict.verdict === "mushtabah").length,
    haram: recent.filter((r) => r.verdict.verdict === "haram").length,
  };

  return (
    <div className="container-page py-16 md:py-24">
      <section className="max-w-3xl">
        <span className="chip mb-6">Live · rule v0.1.0 · mainnet</span>
        <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-[1.05]">
          The compliance verdict on{" "}
          <span className="font-semibold">every Solana token.</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
          Probity reads each token the way a senior compliance officer would.
          Revenue model, sector exposure, supply mechanics, governance — every
          concern surfaces in a single readable report with a citation trail.
          Paste any SPL mint; verdicts are computed live from Solana mainnet.
        </p>

        <div className="mt-10">
          <LookupForm />
          <p className="mt-4 text-xs text-[var(--color-muted-2)]">
            Try{" "}
            {QUICK_EXAMPLES.map((e, i) => (
              <span key={e.mint}>
                <Link
                  href={`/verdict/${e.mint}`}
                  className="mono hover:text-[var(--color-text)] underline-offset-4 hover:underline"
                >
                  {e.label}
                </Link>
                {i < QUICK_EXAMPLES.length - 1 ? ", " : "."}
              </span>
            ))}{" "}
            Each takes ~10s on first lookup (Helius + Claude pipeline).
          </p>
        </div>
      </section>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 grid-bordered">
        <Tile
          label="Halal"
          accent="var(--color-halal)"
          headline={counts.halal.toString()}
          sub="in recent live screenings"
        />
        <Tile
          label="Mushtabah"
          accent="var(--color-mushtabah)"
          headline={counts.mushtabah.toString()}
          sub="awaiting human review"
        />
        <Tile
          label="Haram"
          accent="var(--color-haram)"
          headline={counts.haram.toString()}
          sub="failed a material test"
        />
      </section>

      <section className="mt-20">
        <header className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-medium">Recently screened</h2>
          <p className="text-xs mono uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
            {recent.length} {recent.length === 1 ? "token" : "tokens"} · live
          </p>
        </header>
        {recent.length === 0 ? (
          <div className="surface p-10 text-center">
            <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
              Nothing screened yet. Paste a mint above or try one of the
              examples — verdicts persist here for this session.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {recent.map((r) => (
              <VerdictCard
                key={r.verdict.mint}
                verdict={r.verdict}
                context={r.context}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-24 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FrameworkBlock
          label="Halal"
          verdict="halal"
          text="Clears every material rule — riba, maysir, haram-sector, and gharar. Non-material rules without unresolved fails."
        />
        <FrameworkBlock
          label="Mushtabah"
          verdict="mushtabah"
          text="Doubtful. A material rule is flagged, or a non-material rule fails. Requires deeper human review before a position is taken."
        />
        <FrameworkBlock
          label="Haram"
          verdict="haram"
          text="A material rule fails outright. Cannot be cleared under standard Islamic finance principles."
        />
      </section>
    </div>
  );
}

function Tile({
  label,
  accent,
  headline,
  sub,
}: {
  label: string;
  accent: string;
  headline: string;
  sub: string;
}) {
  return (
    <div className="p-7 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <span
          className="text-[11px] uppercase tracking-[0.2em] font-medium"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
      <p className="text-5xl font-light num tracking-tight">{headline}</p>
      <p className="text-sm text-[var(--color-muted)] mt-2">{sub}</p>
    </div>
  );
}

function FrameworkBlock({
  verdict,
  label,
  text,
}: {
  verdict: "halal" | "mushtabah" | "haram";
  label: string;
  text: string;
}) {
  return (
    <div className="surface p-6">
      <VerdictBadge verdict={verdict} glow />
      <p className="mt-5 text-lg font-medium">{label}</p>
      <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
