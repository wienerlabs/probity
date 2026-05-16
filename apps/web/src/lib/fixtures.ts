import type { ScreeningContext } from "./types";

export const RULE_VERSION = "0.1.0";
export const FIXED_NOW = new Date("2026-05-16T12:00:00.000Z");

export interface DemoFixture {
  context: ScreeningContext;
  seriesSeed: number;
  priceStart: number;
  priceDrift: number;
  priceVol: number;
  holderStart: number;
  holderGrowth: number;
  attestationPubkey: string | null;
}

export const FIXTURES: DemoFixture[] = [
  {
    seriesSeed: 11,
    priceStart: 0.42,
    priceDrift: 0.004,
    priceVol: 0.045,
    holderStart: 18_400,
    holderGrowth: 0.012,
    attestationPubkey: "Att3statN1U7L0000000000000000000000000000",
    context: {
      mint: "Pr0biTy22222222222222222222222222222222UTL2",
      ruleVersion: RULE_VERSION,
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
          {
            program: "AmmRouter1111111111111111111111111111111111",
            kind: "amm-swap",
            primaryRevenueShare: 0.92,
          },
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
    },
  },
  {
    seriesSeed: 7,
    priceStart: 1.0,
    priceDrift: 0.0,
    priceVol: 0.004,
    holderStart: 92_300,
    holderGrowth: 0.006,
    attestationPubkey: null,
    context: {
      mint: "Pr0biTy11111111111111111111111111111111SOL1",
      ruleVersion: RULE_VERSION,
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
                  "A small share of reserve yield is sourced from short-term US Treasury instruments held through a regulated counterparty.",
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
    },
  },
  {
    seriesSeed: 23,
    priceStart: 2.7,
    priceDrift: -0.003,
    priceVol: 0.06,
    holderStart: 5_900,
    holderGrowth: -0.002,
    attestationPubkey: "Att3statN1L3ND0000000000000000000000000000",
    context: {
      mint: "Pr0biTy33333333333333333333333333333333LND3",
      ruleVersion: RULE_VERSION,
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
    },
  },
  {
    seriesSeed: 41,
    priceStart: 0.018,
    priceDrift: 0.006,
    priceVol: 0.09,
    holderStart: 41_200,
    holderGrowth: 0.018,
    attestationPubkey: null,
    context: {
      mint: "Pr0biTy44444444444444444444444444444444GMG4",
      ruleVersion: RULE_VERSION,
      now: FIXED_NOW,
      state: {
        mint: "Pr0biTy44444444444444444444444444444444GMG4",
        decimals: 6,
        supply: "1,500,000,000",
        mintAuthority: null,
        freezeAuthority: null,
        metadata: {
          name: "Demo Gaming",
          symbol: "GMG",
          uri: "ipfs://bafy.../gmg.json",
          isMutable: false,
        },
        metadataAccount: "MetadataPDA0000000000000000000000000000GMG",
        topHolderConcentration: 0.27,
        topHolders: [],
        programInteractions: [],
        snapshotSlot: 318_400_555,
      },
      enrichment: {
        audits: [],
        revenueModel: {
          primary: "in-game-fees",
          exposures: [
            {
              tag: "gaming",
              revenueShare: 0.96,
              source: {
                type: "document",
                sourceUrl: "https://example.org/gaming/tokenomics.md",
                contentHash: "sha256:7e22aab1",
                excerpt: "Primary revenue is platform fees on in-game listings.",
              },
            },
            {
              tag: "gambling",
              revenueShare: 0.04,
              source: {
                type: "document",
                sourceUrl: "https://example.org/gaming/rules.md",
                contentHash: "sha256:9911ffaa",
                excerpt:
                  "Optional tournament module allows wagering of native tokens against other players; protocol takes a 2% rake.",
              },
            },
          ],
          zeroSumRevenueShare: 0.04,
          utilityScore: 0.62,
        },
        governance: {
          timelockSeconds: 172_800,
          multisigThreshold: { m: 4, n: 7 },
          freezeAuthoritySingleKey: false,
        },
      },
    },
  },
  {
    seriesSeed: 59,
    priceStart: 0.84,
    priceDrift: 0.003,
    priceVol: 0.05,
    holderStart: 27_100,
    holderGrowth: 0.014,
    attestationPubkey: "Att3statN1NFT00000000000000000000000000000",
    context: {
      mint: "Pr0biTy55555555555555555555555555555555NFT5",
      ruleVersion: RULE_VERSION,
      now: FIXED_NOW,
      state: {
        mint: "Pr0biTy55555555555555555555555555555555NFT5",
        decimals: 9,
        supply: "500,000,000",
        mintAuthority: null,
        freezeAuthority: null,
        metadata: {
          name: "Demo Marketplace",
          symbol: "MKT",
          uri: "ipfs://bafy.../mkt.json",
          isMutable: false,
        },
        metadataAccount: "MetadataPDA0000000000000000000000000000MKT",
        topHolderConcentration: 0.155,
        topHolders: [],
        programInteractions: [
          {
            program: "MarketplaceV2Pr0gram000000000000000000000",
            kind: "marketplace",
            primaryRevenueShare: 0.91,
          },
        ],
        snapshotSlot: 318_401_002,
      },
      enrichment: {
        audits: [
          {
            type: "document",
            sourceUrl: "https://example.org/marketplace/audit.pdf",
            contentHash: "sha256:5d44b1e2",
            excerpt: "Marketplace listing fees comprise 91% of treasury inflow.",
          },
        ],
        revenueModel: {
          primary: "marketplace-fees",
          exposures: [
            {
              tag: "marketplace",
              revenueShare: 0.91,
              source: {
                type: "derivation",
                formula: "listing_fee_share = 0.91",
                result: "primary_marketplace_revenue",
              },
            },
          ],
          zeroSumRevenueShare: 0,
          utilityScore: 0.74,
          primarySaleRatio: 0.91,
        },
        governance: {
          timelockSeconds: 172_800,
          multisigThreshold: { m: 4, n: 7 },
          freezeAuthoritySingleKey: false,
        },
      },
    },
  },
];
