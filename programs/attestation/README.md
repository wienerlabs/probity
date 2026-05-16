# Probity attestation program

Anchor program that commits a verdict (Halal / Mushtabah / Haram) plus
its rule version and an evidence hash to a deterministic PDA keyed by
`(mint, rule_version)`. Only the original signer can revoke or extend an
attestation. Reads are permissionless.

## Account

```rust
pub struct Attestation {
  pub mint: Pubkey,           // 32
  pub verdict: u8,            // 0 = halal, 1 = mushtabah, 2 = haram
  pub rule_version: [u8; 16], // utf8 padded
  pub evidence_hash: [u8; 32],// sha-256 of canonical citation JSON
  pub computed_at: i64,
  pub expires_at: i64,
  pub signer: Pubkey,
  pub revoked: bool,
  pub bump: u8,
}
```

PDA seeds: `["attestation", mint, rule_version]`.

## Instructions

| Instruction          | Who           | Effect                                        |
|----------------------|---------------|-----------------------------------------------|
| `create_attestation` | Signer        | Initialises the PDA. Verdict ≤ 2, expiry > now. |
| `revoke_attestation` | Original signer | Sets `revoked = true`. Idempotent on second call (errors). |
| `update_expiry`      | Original signer | Extends expiry forward only; rejects on revoked. |

## Errors

| Code | Variant            | Meaning                                          |
|------|--------------------|--------------------------------------------------|
| 6000 | InvalidVerdict     | verdict must be 0, 1, or 2                       |
| 6001 | Unauthorized       | only the original signer may mutate              |
| 6002 | Revoked            | attestation is revoked; mutation refused         |
| 6003 | AlreadyRevoked     | second revoke on the same attestation            |
| 6004 | ExpiryInPast       | new expiry ≤ current slot                        |
| 6005 | ExpiryRegressed    | new expiry < existing expiry                     |

## Build + test (local)

Requires Solana CLI + Anchor CLI 0.30.x.

```bash
# From repo root:
anchor build
anchor test                # spins up a local validator and runs tests/
```

### Toolchain note (build is blocked at HEAD)

Anchor 0.30.1 transitively pins `solana-program 1.18.26`, which bundles
a Cargo 1.84.0 that cannot parse the new edition-2024 manifests now on
crates.io. Several transitive deps (`constant_time_eq 0.4`,
`indexmap 2.14`, `toml_datetime 1.1.1`, etc.) ship edition-2024 only.

The committed `Cargo.lock` pins what it can — but the chain keeps
producing new edition-2024 releases, so `anchor build` will fail at
HEAD on a fresh registry.

**Path forward** (separate milestone, M5.5):

1. Migrate to Anchor 1.x with the Agave / Solana 2.x toolchain — this
   removes the 1.18 pin entirely.
2. Or, freeze the registry: re-pin every transitive dep that has
   slipped to edition-2024 and check the `Cargo.lock` deltas in.

Until then, the program source + tests are reviewable and `cargo check
-p attestation` passes (the parser doesn't touch the SBF build path).

`cargo check` cycle (no SBF, parser-only — passes today):

```bash
cargo check -p attestation
```

Once the toolchain migration lands:

```bash
anchor build
anchor test                # spins up local validator + ts-mocha tests
```

The test bundle covers:
- happy-path create + read
- invalid verdict (6000)
- past expiry (6004)
- unauthorized revoke (6001), happy revoke, double-revoke (6003)
- expiry extension forward, regression (6005)
- two rule versions for one mint resolve to distinct PDAs

## Program id

`HDpm5Ge4Zryoib6KYHewYoeAXXTE3GMkASZNbSpZZa9U` (localnet + devnet seed).
The keypair lives at `target/deploy/attestation-keypair.json` — not
checked in. Generate your own with `solana-keygen new -o
target/deploy/attestation-keypair.json` and update `Anchor.toml` +
`declare_id!()` before deploying.

## Mainnet checklist

- [ ] Multisig signer (Squads, 3-of-5) replaces the dev hot key.
- [ ] `evidence_hash` is verifiable against the off-chain citation JSON
      via the same canonicalisation used in `@probity/engine`.
- [ ] Program upgrade authority moved to a timelocked multisig.
- [ ] `revoke_attestation` reason codes documented and surfaced in
      `@probity/attestation-sdk`.
