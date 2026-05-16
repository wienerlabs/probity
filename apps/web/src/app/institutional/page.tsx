const FEATURES = [
  {
    title: "Batch screening",
    text: "Clear hundreds of tokens against a mandate in seconds. Concurrency-tuned pipelines.",
  },
  {
    title: "Webhook alerts",
    text: "Watch lists fire on status change — when a previously cleared token's revenue model drifts.",
  },
  {
    title: "Exportable audit reports",
    text: "Signed PDF. Rule version pinned. Citation trail intact. Acceptable to a Sharia board.",
  },
  {
    title: "On-chain attestation",
    text: "Verdict, rule version, and evidence hash committed on Solana. Six months from now, the call is still provable.",
  },
  {
    title: "Volume pricing",
    text: "Per call. No seat licensing. No minimum commitment. Bulk tiers for funds and treasuries.",
  },
  {
    title: "Dedicated infra",
    text: "Higher tiers get isolated RPC, priority queues, and SLA-backed latency.",
  },
];

export default function InstitutionalPage() {
  return (
    <div className="container-page py-16 md:py-24 max-w-4xl">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted-2)] mb-5">
        Institutional
      </p>
      <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
        <span className="font-semibold">The fit and proper test</span>{" "}
        <span className="text-[var(--color-muted)]">for digital assets.</span>
      </h1>
      <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
        Built for funds, family offices, treasuries, and Islamic finance
        advisors that need to clear a mandate against hundreds of tokens with a
        defensible audit trail.
      </p>

      <section className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)]">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-[var(--color-bg)] p-6">
            <p className="text-sm font-medium">{f.title}</p>
            <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
              {f.text}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-14 surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-2">
          Talk to us
        </p>
        <p className="text-lg">
          <a
            href="mailto:probity@wienerlabs.com"
            className="hover:underline mono"
          >
            probity@wienerlabs.com
          </a>
        </p>
      </section>
    </div>
  );
}
