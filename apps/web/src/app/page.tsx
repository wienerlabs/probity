import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { VerdictCard } from "@/components/verdict-card";
import { VerdictBadge } from "@/components/verdict-badge";
import { VERDICTS } from "@/lib/mock";

export default function HomePage() {
  const counts = {
    halal: VERDICTS.filter((v) => v.verdict === "halal").length,
    mushtabah: VERDICTS.filter((v) => v.verdict === "mushtabah").length,
    haram: VERDICTS.filter((v) => v.verdict === "haram").length,
  };

  return (
    <div className="container-page py-16 md:py-24">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted-2)] mb-5">
          Demo dataset · rule v0.1.0
        </p>
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
          <p className="mt-3 text-xs text-[var(--color-muted-2)]">
            Try{" "}
            <Link
              href="/verdict/Pr0biTy22222222222222222222222222222222UTL2"
              className="mono hover:text-[var(--color-text)]"
            >
              UTL
            </Link>
            ,{" "}
            <Link
              href="/verdict/Pr0biTy11111111111111111111111111111111SOL1"
              className="mono hover:text-[var(--color-text)]"
            >
              DSTB
            </Link>
            , or{" "}
            <Link
              href="/verdict/Pr0biTy33333333333333333333333333333333LND3"
              className="mono hover:text-[var(--color-text)]"
            >
              LND
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--color-border)] border border-[var(--color-border)]">
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
            {VERDICTS.length} tokens · last 24h
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VERDICTS.map((v) => (
            <VerdictCard key={v.mint} record={v} />
          ))}
        </div>
      </section>

      <section className="mt-24 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
    <div className="bg-[var(--color-bg)] p-6 md:p-8">
      <div className="flex items-center gap-2 mb-4">
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: accent }}
        />
        <span
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
      <p className="text-5xl font-light num">{headline}</p>
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
      <VerdictBadge verdict={verdict} />
      <p className="mt-5 text-lg font-medium">{label}</p>
      <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
