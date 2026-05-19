import Link from "next/link";
import { listDemoKeys } from "@/lib/api/api-keys";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/verdict/{mint}",
    auth: "Public · rate-limited",
    desc: "Latest verdict for a mint.",
  },
  {
    method: "GET",
    path: "/api/v1/verdict/{mint}/history",
    auth: "API key",
    desc: "Verdict timeline across rule versions.",
  },
  {
    method: "POST",
    path: "/api/v1/batch",
    auth: "API key",
    desc: "Screen up to 10,000 mints; returns batch id.",
  },
  {
    method: "GET",
    path: "/api/v1/batch/{id}",
    auth: "API key",
    desc: "Batch status, results, and signed audit URL.",
  },
  {
    method: "POST",
    path: "/api/v1/webhooks",
    auth: "API key",
    desc: "Subscribe to status-change events for a watch list.",
  },
  {
    method: "GET",
    path: "/api/v1/export/{verdict_id}",
    auth: "API key",
    desc: "Signed PDF audit report.",
  },
  {
    method: "GET",
    path: "/api/v1/rules/{version}",
    auth: "Public",
    desc: "Active rule manifest for a version.",
  },
];

export default function ApiPage() {
  return (
    <div className="container-page py-16 md:py-24 max-w-4xl">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted-2)] mb-5">
        Reference
      </p>
      <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
        <span className="font-semibold">API.</span>{" "}
        <span className="text-[var(--color-muted)]">Per call, volume tiers.</span>
      </h1>
      <p className="mt-6 text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
        No seat licensing. No minimums. Webhook on status change. Signed audit
        exports.
      </p>

      <section className="mt-14">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-4">
          Endpoints — v1
        </h2>
        <div className="surface overflow-hidden divide-y divide-[var(--color-border)]">
          {ENDPOINTS.map((e) => (
            <div
              key={e.path}
              className="grid grid-cols-[4.5rem_1fr] md:grid-cols-[4.5rem_1fr_9rem] gap-4 px-5 py-4 text-sm hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text)] flex items-center">
                <span
                  className="px-2 py-0.5 rounded-full border"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {e.method}
                </span>
              </span>
              <div className="min-w-0">
                <p className="mono text-[var(--color-text)] truncate">{e.path}</p>
                <p className="text-[var(--color-muted)] mt-1">{e.desc}</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] md:text-right self-center">
                {e.auth}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 surface p-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-3">
          Headers
        </h2>
        <p className="mono text-sm leading-relaxed text-[var(--color-muted)]">
          <span className="text-[var(--color-text)]">X-Probity-Rule-Version</span>{" "}
          declares the rule manifest used. Pin it for reproducibility.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-3">
          API keys
        </h2>
        <p className="text-[var(--color-muted)] leading-relaxed text-sm mb-4 max-w-2xl">
          Programmatic access is gated by a Bearer token derived from a
          server-configured HMAC secret. Keys are issued out-of-band; the
          public API surface ships zero default credentials.
        </p>
        {listDemoKeys().length === 0 ? (
          <div className="surface p-5 text-sm text-[var(--color-muted)] leading-relaxed">
            No API keys are configured on this instance. Operators provision keys
            via the <span className="mono">PROBITY_API_KEYS</span> environment
            entry; end users authenticate with a Solana wallet instead.
          </div>
        ) : (
          <div className="surface overflow-hidden divide-y divide-[var(--color-border)]">
            {listDemoKeys().map((k) => (
              <div
                key={k.key}
                className="grid grid-cols-[1fr_6rem] md:grid-cols-[1fr_6rem_6rem] gap-4 px-5 py-3.5 text-sm"
              >
                <span className="mono text-[var(--color-text)] truncate">
                  {k.key}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] self-center">
                  tier · {k.tier}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] self-center md:text-right">
                  owner · {k.owner}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 surface p-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-3">
          Curl in 30 seconds
        </h2>
        <pre
          className="mono text-xs leading-relaxed overflow-x-auto p-4 rounded-[var(--radius-md)]"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
{`# Verdict (wallet session OR API key required)
curl -s https://probity.wienerlabs.com/api/v1/verdict/So11111111111111111111111111111111111111112 \\
  -H "authorization: Bearer $PROBITY_API_KEY" | jq .

# Active rule manifest (public)
curl -s https://probity.wienerlabs.com/api/v1/rules/0.1.0 | jq .

# Batch screen (institutional)
curl -s -X POST https://probity.wienerlabs.com/api/v1/batch \\
  -H "authorization: Bearer $PROBITY_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"mints":["So11111111111111111111111111111111111111112"]}'`}
        </pre>
      </section>

      <div className="mt-10">
        <Link href="/institutional" className="btn">
          Talk to us about institutional access
        </Link>
      </div>
    </div>
  );
}
