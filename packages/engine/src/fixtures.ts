import type { ScreeningContext } from "@probity/types";

// Pinned now() for deterministic fixtures.
export const FIXED_NOW = new Date("2026-05-16T12:00:00.000Z");

export const utilityHalal: ScreeningContext = {
  mint: "Pr0biTy22222222222222222222222222222222UTL2",
  ruleVersion: "0.1.0",
  now: FIXED_NOW,
  state: {
    mint: "Pr0biTy22222222222222222222222222222222UTL2",
    decimals: 9,
    supply: "1,000,000,000",
    mintAuthority: null,
    freezeAuthority: null,
    metadata: {
      name: "Demo Utility",
      symbol: "UTL",
      uri: "ipfs://bafy.../utl.json",
      isMutable: false,
    },
    metadataAccount: "MetadataPDA0000000000000000000000000000UTL",
    topHolderConcentration: 0.182,
    topHolders: [],
    programInteractions: [
      { program: "AmmRouter1111111111111111111111111111111111", kind: "amm-swap", primaryRevenueShare: 0.92 },
      { program: "RoutingRebate1111111111111111111111111111111", kind: "other", primaryRevenueShare: 0.08 },
    ],
    snapshotSlot: 318_402_993,
  },
  enrichment: {
    audits: [
      {
        type: "document",
        sourceUrl: "https://example.org/utility/audit-2026.pdf",
        contentHash: "sha256:1aaf9b30",
        excerpt:
          "Q1 2026 revenue breakdown: 92% swap aggregation fees, 8% routing rebates.",
      },
    ],
    revenueModel: {
      primary: "swap-aggregation-fees",
      exposures: [
        {
          tag: "primary-utility",
          revenueShare: 0.92,
          source: {
            type: "derivation",
            formula: "swap_fee_share = 0.92",
            result: "primary_utility_revenue",
          },
        },
      ],
      zeroSumRevenueShare: 0,
      utilityScore: 0.78,
    },
    governance: {
      timelockSeconds: 172_800,
      multisigThreshold: { m: 4, n: 7 },
      freezeAuthoritySingleKey: false,
    },
  },
};

export const lendingHaram: ScreeningContext = {
  mint: "Pr0biTy33333333333333333333333333333333LND3",
  ruleVersion: "0.1.0",
  now: FIXED_NOW,
  state: {
    mint: "Pr0biTy33333333333333333333333333333333LND3",
    decimals: 6,
    supply: "250,000,000",
    mintAuthority: "M1nt3rPDA000000000000000000000000000000000",
    freezeAuthority: null,
    metadata: {
      name: "Demo Lending",
      symbol: "LND",
      uri: "ipfs://bafy.../lnd.json",
      isMutable: false,
    },
    metadataAccount: "MetadataPDA0000000000000000000000000000LND",
    topHolderConcentration: 0.33,
    topHolders: [],
    programInteractions: [
      {
        program: "MarginLendingV3Pr0gramId000000000000000000",
        kind: "lending-interest-bearing",
        primaryRevenueShare: 0.74,
      },
    ],
    snapshotSlot: 318_402_889,
  },
  enrichment: {
    audits: [],
    revenueModel: {
      primary: "lending-spread",
      exposures: [
        {
          tag: "lending-interest",
          revenueShare: 0.74,
          source: {
            type: "document",
            sourceUrl: "https://example.org/lending-token/whitepaper.pdf",
            contentHash: "sha256:4b8dc192",
            excerpt:
              "Holders earn a variable APR generated from a USDC lending pool integrated with a conventional money market.",
          },
        },
      ],
      zeroSumRevenueShare: 0,
      utilityScore: 0.55,
    },
    governance: {
      timelockSeconds: 172_800,
      multisigThreshold: { m: 4, n: 7 },
      freezeAuthoritySingleKey: false,
    },
  },
};

export const stablecoinMushtabah: ScreeningContext = {
  mint: "Pr0biTy11111111111111111111111111111111SOL1",
  ruleVersion: "0.1.0",
  now: FIXED_NOW,
  state: {
    mint: "Pr0biTy11111111111111111111111111111111SOL1",
    decimals: 6,
    supply: "412,000,000",
    mintAuthority: "M1nt3rPDA000000000000000000000000000000000",
    freezeAuthority: "Fr0zenSingleK3y0000000000000000000000000000",
    metadata: {
      name: "Demo Stablecoin",
      symbol: "DSTB",
      uri: "ipfs://bafy.../dstb.json",
      isMutable: false,
    },
    metadataAccount: "MetadataPDA0000000000000000000000000000DSTB",
    topHolderConcentration: 0.41,
    topHolders: [],
    programInteractions: [],
    snapshotSlot: 317_998_711,
  },
  enrichment: {
    audits: [],
    revenueModel: {
      primary: "reserve-yield",
      exposures: [
        {
          tag: "stablecoin",
          revenueShare: 0.96,
          source: {
            type: "document",
            sourceUrl: "https://example.org/stable/reserves-q1.pdf",
            contentHash: "sha256:c0dedada",
            excerpt:
              "Reserves are held with regulated counterparties and US Treasury instruments.",
          },
        },
        {
          tag: "conventional-finance",
          revenueShare: 0.04,
          source: {
            type: "document",
            sourceUrl: "https://example.org/stable/reserves-q1.pdf",
            contentHash: "sha256:c0dedada",
            excerpt:
              "Reserve yield is partially derived from short-term US Treasury instruments held through a regulated counterparty.",
          },
        },
      ],
      zeroSumRevenueShare: 0,
      utilityScore: 0.85,
    },
    governance: {
      timelockSeconds: 0,
      multisigThreshold: null,
      freezeAuthoritySingleKey: true,
    },
  },
};
