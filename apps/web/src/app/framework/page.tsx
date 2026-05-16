import { VerdictBadge } from "@/components/verdict-badge";

const TESTS = [
  {
    category: "Riba",
    material: true,
    summary:
      "No interest-bearing income in the issuer's revenue model or in the token's yield source. Lending protocols paying conventional interest fail.",
  },
  {
    category: "Maysir",
    material: true,
    summary:
      "No betting, lottery, or zero-sum derivatives as primary revenue. Pure-speculation memecoins land in Mushtabah unless utility evidence clears them.",
  },
  {
    category: "Gharar",
    material: false,
    summary:
      "Tokenomics, supply mechanics, and governance must be transparent. Hidden mint authority or undisclosed treasury pushes toward Haram.",
  },
  {
    category: "Haram sector",
    material: true,
    summary:
      "Material exposure (>5% revenue) to alcohol, gambling, adult content, tobacco, weapons, conventional banking/insurance, or pork fails.",
  },
  {
    category: "Governance",
    material: false,
    summary:
      "Mutable freeze authorities, single-key control, opaque proposal flows surface as flags pending review.",
  },
  {
    category: "Transparency",
    material: false,
    summary:
      "Mutable metadata, undisclosed treasuries, unverifiable claims surface as flags.",
  },
];

export default function FrameworkPage() {
  return (
    <div className="container-page py-16 md:py-24 max-w-4xl">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted-2)] mb-5">
        Methodology
      </p>
      <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
        The <span className="font-semibold">screening framework.</span>
      </h1>
      <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
        Probity codifies AAOIFI-aligned screening into a deterministic rule set.
        Every verdict is reproducible from a pinned rule version and an
        on-chain snapshot.
      </p>

      <section className="mt-14">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
          Verdicts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <VerdictExplainer
            verdict="halal"
            text="All material rules pass and no non-material rule fails."
          />
          <VerdictExplainer
            verdict="mushtabah"
            text="A material rule is flagged, or a non-material rule fails."
          />
          <VerdictExplainer
            verdict="haram"
            text="A material rule fails outright."
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
          Tests
        </h2>
        <div className="space-y-3">
          {TESTS.map((t) => (
            <div key={t.category} className="surface p-5">
              <div className="flex items-center gap-3 mb-2">
                <p className="text-sm font-medium">{t.category}</p>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
                  {t.material ? "material" : "non-material"}
                </span>
              </div>
              <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                {t.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 surface p-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-3">
          Determinism
        </h2>
        <p className="text-[var(--color-muted)] leading-relaxed">
          A verdict is reproducible from{" "}
          <span className="mono text-[var(--color-text)]">
            (mint, rule_version, snapshot_slot)
          </span>
          . Citation hashes are committed on-chain so a recomputation six
          months later remains comparable to the original record.
        </p>
      </section>
    </div>
  );
}

function VerdictExplainer({
  verdict,
  text,
}: {
  verdict: "halal" | "mushtabah" | "haram";
  text: string;
}) {
  return (
    <div className="surface p-5">
      <VerdictBadge verdict={verdict} />
      <p className="mt-4 text-sm text-[var(--color-muted)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
