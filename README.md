# Probity

**The compliance verdict on every Solana token.**

> Probity. Know before you buy.

Probity reads each token on Solana the way a senior compliance officer would. It examines the issuer's revenue model for interest-based income, inspects the underlying asset for exposure to alcohol, gambling, adult content, tobacco, weapons, and conventional finance, evaluates governance and supply mechanics for excessive uncertainty and speculative structures, and surfaces every concern in a single readable report.

## Verdicts

Every token receives one of three verdicts. Every verdict ships with a full citation trail.

| Verdict | Meaning |
|---|---|
| **Halal** | Clears every test in the screening framework |
| **Mushtabah** | Doubtful — requires deeper human review before a position is taken |
| **Haram** | Fails one or more material tests and cannot be cleared under standard Islamic finance principles |

Verdicts are timestamped on-chain. Six months from now you can prove the call you made was correct at the time it was made, even if the underlying token's revenue model has since drifted.

## Who it is for

- **Wallet holders** — free public dashboard. Check a ticker before you buy.
- **Funds, family offices, treasuries** — batch screening API to clear hundreds of tokens against a mandate in seconds.
- **Islamic finance advisors** — full audit logs, exportable compliance reports, webhook alerts when a previously cleared token's status changes.

## How it works

1. **Ingest** — pull mint metadata, supply mechanics, mint/freeze authority, holder distribution, and program interactions from Solana RPC and Helius.
2. **Enrich** — fetch whitepaper, project documentation, audit reports, treasury composition.
3. **Screen** — evaluate against the Probity rule framework (revenue model, sector exposure, tokenomics, governance, gharar/maysir surface).
4. **Verdict** — Halal / Mushtabah / Haram, with every rule outcome and supporting evidence.
5. **Attest** — verdict, rule version, and evidence hash committed on-chain so the call is auditable forever.

## Pricing

| Tier | For | Pricing |
|---|---|---|
| Public dashboard | Individual wallet holders | Free |
| API | Funds, treasuries, advisors | Per call, volume tiers, no seat licensing, no minimums |

## Positioning

> **Probity. Know before you buy.**
>
> *The fit and proper test for digital assets.*

## Status

Pre-launch. Spec lives in [CLAUDE.md](./CLAUDE.md). Engineering kicks off from there.

## License

TBD. All rights reserved until license is set.
