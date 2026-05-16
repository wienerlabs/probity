# Probity — Engineering Spec

> This file is the canonical spec for Probity. It is the brain of the project. Claude Code reads this on every session to align with intent, architecture, and rule logic. Update this file whenever a load-bearing decision changes — drift between code and spec is a defect.

---

## 1. Product summary

Probity issues a compliance verdict on every Solana token under an Islamic-finance screening framework. Three verdicts: **Halal**, **Mushtabah**, **Haram**. Every verdict ships with a citation trail and an on-chain timestamped attestation.

- **Free public dashboard** — single-ticker lookup, no auth, rate-limited per wallet.
- **Institutional API** — batch screening, webhooks, exportable audit reports, volume pricing.

Positioning: *Probity. Know before you buy.* / *The fit and proper test for digital assets.*

---

## 2. Compliance framework

The framework is the product. Code without a clear rule lineage is not shippable.

### 2.1 Foundational principles (AAOIFI-aligned)

| Principle | Test |
|---|---|
| **Riba** (interest) | No interest-bearing income in the issuer's revenue model or in the token's yield source. Lending protocols paying conventional interest fail. |
| **Maysir** (gambling / zero-sum speculation) | No betting, lottery, or zero-sum derivatives as primary revenue. Pure-speculation memecoins land in Mushtabah by default unless governance/utility evidence clears them. |
| **Gharar** (excessive uncertainty) | Tokenomics, supply mechanics, and governance must be transparent. Hidden mint authority, undisclosed treasury, or unverifiable claims push toward Haram. |
| **Haram sectors** | Alcohol, gambling, adult content, tobacco, weapons (offensive), conventional banking/insurance, pork. Material exposure (>5% revenue) fails. |
| **Asset backing & utility** | Tokens must represent identifiable utility, equity-like ownership, or asset claim. Pure rent-extraction with no underlying asset is Mushtabah. |

### 2.2 Token-specific signals (Solana-native)

- **Mint authority** — present and not renounced → flag for review.
- **Freeze authority** — present → flag (custodial control over user funds).
- **Supply mechanics** — uncapped + active mint authority + opaque emission schedule → Haram-leaning.
- **Holder distribution** — top 10 wallets > 70% → flag (insider concentration risk).
- **Program interactions** — does the mint interact with known interest-bearing lending programs as a primary revenue source?
- **Metadata immutability** — mutable URI controlled by single key → flag (rug surface).
- **Liquidity source** — LP yields sourced from interest-bearing pools → fails riba.

### 2.3 Verdict aggregation

Each rule emits `{outcome: pass | fail | flag, weight, evidence[]}`. Aggregation:

- Any `fail` on a **material** rule (riba, haram sector, maysir) → **Haram**.
- Any `flag` on a material rule OR `fail` on a non-material rule → **Mushtabah**.
- All material rules `pass` AND no non-material `fail` → **Halal**.

Rule materiality is declared in the rule definition (see §4.3). Materiality is a versioned decision — changing it requires a rule-version bump.

---

## 3. Architecture

### 3.1 Trade-off: monorepo vs polyrepo

| Option | Pro | Con |
|---|---|---|
| **Monorepo (Turborepo + pnpm)** | Shared types, one CI, atomic refactors across web/API/program | Heavier tooling, slower cold starts |
| **Polyrepo** | Independent deploys, smaller blast radius | Type drift, duplicated infra |

**Lock:** Monorepo. Probity is small enough that atomic refactor wins over deploy independence. Revisit at >5 apps.

### 3.2 Layout

```
probity/
├── apps/
│   ├── web/                 # Next.js 16 dashboard + API routes (Turbopack)
│   └── docs/                # Mintlify or Nextra — public API docs
├── packages/
│   ├── engine/              # Screening engine (pure TS, no framework deps)
│   ├── rules/               # Versioned rule definitions (TS + JSON Schema)
│   ├── solana/              # RPC, Helius, Metaplex wrappers
│   ├── enrichment/          # Whitepaper/docs/audit fetchers
│   ├── attestation-sdk/     # Client for the on-chain program
│   ├── types/               # Shared TS types (verdict, rule, citation)
│   └── db/                  # Supabase schema + generated types
├── programs/
│   └── attestation/         # Anchor program — on-chain verdict commits
├── infra/
│   └── supabase/            # SQL migrations, RLS policies, edge functions
└── CLAUDE.md
```

### 3.3 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 16 + Turbopack + Tailwind + shadcn/ui** | Wiener Labs default; SSR for dashboard SEO; RSC for verdict pages |
| API | **Next.js API routes (Edge runtime where stateless)** | Co-locate with web until throughput demands split |
| DB | **Supabase (Postgres + RLS + Edge Functions)** | RLS for tier isolation, pgvector for evidence embedding, generated TS types |
| RPC | **Helius (primary) + Triton (fallback)** | DAS API for token metadata, enhanced webhooks for re-screening triggers |
| LLM | **Claude Opus 4.7 (reasoning) + Haiku 4.5 (batch)** | Routed by `packages/engine/router.ts` — see §5.4 |
| On-chain | **Anchor 0.30+** | Solana attestation program; PDA-keyed per (mint, rule_version) |
| Queue | **Inngest** | Batch screening, webhook delivery, scheduled re-screens |
| Auth | **Clerk** for institutional dashboard; API-key auth for programmatic | Wallet-only auth for public dashboard (no PII) |
| Observability | **Axiom + Sentry** | Structured logs (Axiom), error tracking (Sentry) |

### 3.4 Data flow — single verdict

```
mint address
  → solana/fetch_token_state()        // RPC + Helius DAS
  → enrichment/gather()                // whitepaper, docs, audits
  → engine/screen({state, enrichment, rule_version})
      → rules.forEach(rule => rule.evaluate(ctx))
      → aggregate(outcomes) → verdict
  → db.persist(verdict, citations)
  → attestation/commit()               // on-chain PDA (optional, paid tier)
  → response(verdict, citations, attestation_pubkey?)
```

### 3.5 Data flow — batch

```
POST /api/v1/batch { mints: string[], webhook?: url }
  → inngest.send("batch.screen", { batch_id, mints })
  → for each mint (concurrency=20):
      → engine pipeline
      → persist
      → emit batch_id progress event
  → on complete: webhook POST + S3 audit export
```

---

## 4. Modules — contracts

Every module exports types from `packages/types`. No implicit shape passing.

### 4.1 `packages/engine`

```ts
export interface ScreeningContext {
  mint: string;
  state: SolanaTokenState;
  enrichment: EnrichmentBundle;
  ruleVersion: string;        // semver
  now: Date;
}

export interface RuleOutcome {
  ruleId: string;
  ruleVersion: string;
  outcome: "pass" | "fail" | "flag";
  material: boolean;
  evidence: Citation[];
  rationale: string;          // human-readable, <500 chars
}

export interface Verdict {
  mint: string;
  verdict: "halal" | "mushtabah" | "haram";
  ruleVersion: string;
  outcomes: RuleOutcome[];
  citations: Citation[];
  computedAt: Date;
  expiresAt: Date;
  attestation?: { pubkey: string; signature: string };
}

export function screen(ctx: ScreeningContext): Promise<Verdict>;
```

### 4.2 `packages/solana`

```ts
export interface SolanaTokenState {
  mint: string;
  decimals: number;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  metadata: TokenMetadata;
  topHolders: HolderEntry[];
  programInteractions: ProgramInteraction[];
}
export function fetchTokenState(mint: string): Promise<SolanaTokenState>;
```

### 4.3 `packages/rules`

Rules are versioned. Each rule lives in `packages/rules/v{semver}/{rule_id}.ts`:

```ts
export const rule: RuleDefinition = {
  id: "riba.lending-protocol-interaction",
  version: "1.0.0",
  material: true,
  category: "riba",
  description: "Token's primary revenue derives from interest-bearing lending program.",
  evaluate: async (ctx): Promise<RuleOutcome> => { ... },
};
```

Rule changes ship as a new `version` directory. The active rule set is pinned per verdict — historical verdicts remain reproducible.

### 4.4 `programs/attestation` (Anchor)

```rust
#[account]
pub struct Attestation {
    pub mint: Pubkey,           // 32
    pub verdict: u8,            // 0=halal, 1=mushtabah, 2=haram
    pub rule_version: [u8; 16], // semver as fixed bytes
    pub evidence_hash: [u8; 32],// SHA-256 of canonical citation JSON
    pub computed_at: i64,
    pub expires_at: i64,
    pub signer: Pubkey,
    pub revoked: bool,
}
// PDA seeds: [b"attestation", mint.as_ref(), rule_version.as_ref()]
```

Instructions: `create_attestation`, `revoke_attestation`, `update_expiry`.

Only Probity's signer key (multisig in prod) can write. Reads are permissionless.

---

## 5. Engine internals

### 5.1 Determinism

Verdicts must be reproducible. Two runs with the same `(mint, rule_version, snapshot_slot)` must produce byte-identical citation hashes. This means:

- LLM calls use temperature 0 and seeded sampling.
- LLM outputs are validated against Zod schemas before entering the citation set.
- Any non-deterministic input (timestamp, current price) is pinned in the `ScreeningContext` and recorded in the citation.

### 5.2 Citation discipline

Every `RuleOutcome.evidence[]` entry must be one of:

- **On-chain** — `{type: "onchain", account: pubkey, slot: number, field: string, value: any}`
- **Document** — `{type: "document", source_url: string, content_hash: string, excerpt: string}`
- **Derivation** — `{type: "derivation", inputs: Citation[], formula: string, result: any}`

No "the model said so" citations. If the LLM is in the loop, the LLM's output is itself an evidence node with the prompt hash, model id, and the raw response stored.

### 5.3 Rule materiality table (initial)

| Rule category | Material? | Default outcome on missing data |
|---|---|---|
| `riba.*` | yes | `flag` |
| `haram-sector.*` | yes | `flag` |
| `maysir.*` | yes | `flag` |
| `gharar.tokenomics.*` | no | `flag` |
| `governance.*` | no | `pass` |
| `transparency.*` | no | `flag` |

### 5.4 LLM routing

```
classify(task) →
  | rule_evaluation_with_nuance     → opus-4-7 (1m ctx if doc-heavy)
  | batch_classification (sector)    → haiku-4-5
  | citation_summarization           → haiku-4-5
  | governance_clause_extraction     → opus-4-7
```

Prompt cache on rule prompt prefixes — every rule's static instruction block is cached; only the per-mint context is uncached.

---

## 6. API surface (v1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/verdict/{mint}` | Public (rate-limited) | Latest verdict |
| `GET` | `/api/v1/verdict/{mint}/history` | API key | Verdict timeline |
| `POST` | `/api/v1/batch` | API key | Batch screen |
| `GET` | `/api/v1/batch/{id}` | API key | Batch status + results |
| `POST` | `/api/v1/webhooks` | API key | Subscribe to status-change events |
| `GET` | `/api/v1/export/{verdict_id}` | API key | Signed PDF audit report |
| `GET` | `/api/v1/rules/{version}` | Public | Active rule manifest |

All responses include `X-Probity-Rule-Version` header. Verdict responses include `attestation_pubkey` when on-chain commit is enabled for the tier.

---

## 7. Database schema (Supabase / Postgres)

```sql
-- Token registry, lazily populated
tokens (mint pk, decimals, first_seen, last_screened, metadata jsonb)

-- Verdict history (append-only)
verdicts (
  id uuid pk,
  mint references tokens,
  verdict text check (verdict in ('halal','mushtabah','haram')),
  rule_version text,
  computed_at timestamptz,
  expires_at timestamptz,
  evidence_hash bytea,
  attestation_pubkey text null,
  raw jsonb       -- full Verdict object
)
create index on verdicts (mint, computed_at desc);

-- Citations (denormalized for fast audit export)
citations (id uuid pk, verdict_id references verdicts, type text, payload jsonb)

-- API tenancy
api_keys (id uuid pk, hashed_key bytea, tier text, owner_org text, created_at, revoked_at)
audit_logs (id bigserial, api_key_id, ts, method, path, status, latency_ms, mint text null)
webhooks (id uuid pk, api_key_id, url, event_types text[], secret bytea, created_at)
```

RLS: `api_keys`, `audit_logs`, `webhooks` isolated by `owner_org`. `verdicts` and `citations` are world-readable.

---

## 8. Security

- **Signer custody** — attestation signer is a Squads multisig (3-of-5) in prod. Dev uses a hot key with key rotation every 90 days.
- **API key storage** — HMAC-SHA-256 hashed, never logged plaintext. Keys shown once on creation.
- **Webhook signatures** — Ed25519 over payload + timestamp. Replay window 5 min.
- **Rate limiting** — public tier: 60/hour/IP; institutional tiers: enforced server-side per key.
- **Citation tampering** — `evidence_hash` is committed on-chain; any DB-side mutation is detectable by re-hashing.
- **PII** — none stored. Institutional dashboard auth is email + magic link via Clerk; no other PII collected.

---

## 9. Engineering workflow

> Wiener Labs convention: challenge-accept-sharpen-lock. Trade-offs surface as tables with a recommendation. Never ship "what do you think?" planning.

1. **Research & reuse** — search GitHub, Context7 docs, registries before writing. Adopt over invent.
2. **Plan** — `planner` agent for any multi-file change. Output PRD-style note in `/notes/`.
3. **TDD** — write the failing test first. Engine, rules, and attestation program all require unit + integration coverage ≥ 80%.
4. **Implement** — smallest diff that turns the test green.
5. **Review** — `code-reviewer` agent + `security-reviewer` on auth/payment/key paths.
6. **Commit** — Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

### 9.1 Test budget

| Surface | Coverage floor | Notes |
|---|---|---|
| `packages/engine` | 90% | Deterministic; no excuse to be lower |
| `packages/rules` | 100% on `evaluate` | Each rule needs pass / fail / flag cases |
| `programs/attestation` | 95% | Anchor mocha tests + bankrun fuzz |
| `apps/web` | 70% | E2E (Playwright) for verdict page + API surface |

### 9.2 Branching

`main` is always deployable. Feature branches: `feat/<short-slug>`. PRs require green CI + 1 review (self-review counts at this stage; tighten when team grows).

---

## 10. Roadmap

| Milestone | Scope | Definition of done |
|---|---|---|
| **M0 — Scaffold** | Repo, spec, README, CI skeleton | This commit |
| **M1 — Engine core** | `packages/engine`, `packages/rules` v0.1.0 with 5 seed rules, deterministic | Unit tests green, golden verdict fixtures stable across reruns |
| **M2 — Solana ingest** | `packages/solana` covering DAS + program interactions | Real-mint integration tests against devnet fixtures |
| **M3 — Dashboard MVP** | `apps/web` single-ticker verdict page | E2E: search → fetch → verdict + citations rendered |
| **M4 — API + auth** | Public + institutional endpoints, rate limits, API keys | Postman collection passing; rate limits load-tested |
| **M5 — Attestation program** | Anchor program, mainnet-beta deploy plan, SDK | Audit-ready; localnet + devnet green |
| **M6 — Batch + webhooks** | Inngest pipelines, webhook delivery, exports | 1000-mint batch under 2 min p95 |
| **M7 — Compliance dashboard** | Org-level views, audit log export, role-based access | Pilot customer onboarded |

---

## 11. Open decisions

These are deliberately unresolved. Resolving any requires updating this file.

- [ ] **Sharia board** — name advisors before M3. Verdicts referencing AAOIFI need named human oversight to carry institutional weight.
- [ ] **Rule licensing** — are the rule definitions open source (signaling transparency) or proprietary (defensibility)? Affects `packages/rules` license header.
- [ ] **Stablecoin handling** — fiat-backed stables are conventionally Mushtabah pending issuer-revenue analysis. Need a dedicated rule track.
- [ ] **NFT scope** — v1 is fungible SPL tokens only. NFT verdicts (royalty mechanics, underlying art) are a separate framework — defer to v2.
- [ ] **Expiry window** — default `expires_at` for a verdict. Proposal: 30 days for active issuers, 90 days for dormant.

---

## 12. Anti-goals

To keep scope honest:

- **No editorial judgment beyond the framework.** If the rules pass, the verdict is Halal even if a human reviewer would call it tacky.
- **No predictions.** Probity does not say a token will perform well, only that it currently passes screens.
- **No fatwa.** Probity is a screening tool, not a religious ruling. Institutional users pair it with their own scholar of record.
- **No seat licensing.** Pricing is per call. Adding seat tiers is a regression of the positioning.
- **No subscriptions for individual lookups.** Public dashboard stays free for wallet holders.
