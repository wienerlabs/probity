import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { VerdictCard } from "@/components/verdict-card";
import { VerdictBadge } from "@/components/verdict-badge";
import { RECORDS } from "@/lib/screening";

export default function HomePage() {
  const counts = {
    halal: RECORDS.filter((r) => r.verdict.verdict === "halal").length,
    mushtabah: RECORDS.filter((r) => r.verdict.verdict === "mushtabah").length,
    haram: RECORDS.filter((r) => r.verdict.verdict === "haram").length,
  };

  return (
    <div className="container-page py-16 md:py-24">
      <section className="max-w-3xl">
        <span className="chip mb-6">Demo dataset · rule v0.1.0</span>
        <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-[1.05]">
          The compliance verdict on{" "}
          <span className="font-semibold">every Solana token.</span>
        </h1>
        <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
          Probity reads each token the way a senior compliance officer would.
          Revenue model, sector exposure, supply mechanics, governance — every
          concern surfaces in a single readable report with a citation trail.
        </p>

        <div className="mt-10">
          <LookupForm />
          <p className="mt-4 text-xs text-[var(--color-muted-2)]">
            Try{" "}
            <TryLink mint="Pr0biTy22222222222222222222222222222222UTL2">UTL</TryLink>
            ,{" "}
            <TryLink mint="Pr0biTy11111111111111111111111111111111SOL1">DSTB</TryLink>
            , or{" "}
            <TryLink mint="Pr0biTy33333333333333333333333333333333LND3">LND</TryLink>
            .
          </p>
        </div>
      </section>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 grid-bordered">
        <Tile
          label="Halal"
          accent="var(--color-halal)"
          headline={counts.halal.toString()}
          sub="cleared in screened set"
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
            {RECORDS.length} tokens · last 24h
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {RECORDS.map((r) => (
            <VerdictCard key={r.verdict.mint} record={r} />
          ))}
        </div>
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

function TryLink({ mint, children }: { mint: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/verdict/${mint}`}
      className="mono hover:text-[var(--color-text)] underline-offset-4 hover:underline"
    >
      {children}
    </Link>
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
