import type {
  HolderSeriesPoint,
  PriceSeriesPoint,
  RuleOutcome,
  VerdictRecord,
} from "./types";

const DAY = 86_400;

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildPriceSeries(
  seed: number,
  days: number,
  start: number,
  drift: number,
  vol: number,
): PriceSeriesPoint[] {
  const rng = seededRandom(seed);
  const series: PriceSeriesPoint[] = [];
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - days * DAY;
  let price = start;
  for (let i = 0; i < days; i++) {
    const t = startTime + i * DAY;
    const open = price;
    const shock = (rng() - 0.5) * vol * 2;
    const close = Math.max(0.0001, open * (1 + drift + shock));
    const high = Math.max(open, close) * (1 + rng() * vol * 0.5);
    const low = Math.min(open, close) * (1 - rng() * vol * 0.5);
    series.push({ time: t, open, high, low, close });
    price = close;
  }
  return series;
}

function buildHolderSeries(
  seed: number,
  days: number,
  start: number,
  growth: number,
): HolderSeriesPoint[] {
  const rng = seededRandom(seed + 1);
  const series: HolderSeriesPoint[] = [];
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - days * DAY;
  let v = start;
  for (let i = 0; i < days; i++) {
    const t = startTime + i * DAY;
    v = Math.max(1, Math.floor(v * (1 + growth + (rng() - 0.5) * 0.04)));
    series.push({ time: t, value: v });
  }
  return series;
}

const RULE_VERSION = "0.1.0";

const ribaPass = (rationale: string): RuleOutcome => ({
  ruleId: "riba.lending-protocol-interaction",
  ruleVersion: RULE_VERSION,
  category: "riba",
  material: true,
  outcome: "pass",
  rationale,
  evidence: [
    {
      type: "onchain",
      account: "Program11111111111111111111111111111111111",
      slot: 318_402_993,
      field: "program_interactions",
      value: "no_interest_bearing_program_calls_observed",
    },
  ],
});

const ribaFail = (rationale: string): RuleOutcome => ({
  ruleId: "riba.lending-protocol-interaction",
  ruleVersion: RULE_VERSION,
  category: "riba",
  material: true,
  outcome: "fail",
  rationale,
  evidence: [
    {
      type: "onchain",
      account: "MarginLendingV3Pr0gramId000000000000000000",
      slot: 318_402_889,
      field: "program_interactions",
      value: "primary_revenue_via_interest_lending_pool",
    },
    {
      type: "document",
      sourceUrl: "https://example.org/lending-token/whitepaper.pdf",
      contentHash: "sha256:4b8d…c192",
      excerpt:
        "Holders earn a variable APR generated from a USDC lending pool integrated with a conventional money market.",
    },
  ],
});

const sectorPass: RuleOutcome = {
  ruleId: "haram-sector.exposure",
  ruleVersion: RULE_VERSION,
  category: "haram-sector",
  material: true,
  outcome: "pass",
  rationale:
    "Issuer revenue derived from on-chain swap fees and protocol services; no exposure to gambling, alcohol, tobacco, weapons, adult content, or conventional finance.",
  evidence: [
    {
      type: "document",
      sourceUrl: "https://example.org/utility/audit-2026.pdf",
      contentHash: "sha256:1aaf…9b30",
      excerpt:
        "Q1 2026 revenue breakdown: 92% swap aggregation fees, 8% routing rebates.",
    },
  ],
};

const sectorFlag: RuleOutcome = {
  ruleId: "haram-sector.exposure",
  ruleVersion: RULE_VERSION,
  category: "haram-sector",
  material: true,
  outcome: "flag",
  rationale:
    "Adjacent revenue stream from in-game wagering events. Below the 5% material threshold but requires human review.",
  evidence: [
    {
      type: "document",
      sourceUrl: "https://example.org/gaming/tokenomics.md",
      contentHash: "sha256:7e22…aab1",
      excerpt:
        "An optional tournament module allows wagering of native tokens against other players; the protocol takes a 2% rake.",
    },
  ],
};

const maysirFlag: RuleOutcome = {
  ruleId: "maysir.zero-sum-structures",
  ruleVersion: RULE_VERSION,
  category: "maysir",
  material: true,
  outcome: "flag",
  rationale:
    "Speculative narrative without identifiable utility or asset claim. Listed in Mushtabah pending issuer disclosure.",
  evidence: [
    {
      type: "derivation",
      formula: "utility_score = 0.18 (< threshold 0.40)",
      result: "no_clear_utility_basis",
    },
  ],
};

const gharaPass: RuleOutcome = {
  ruleId: "gharar.tokenomics-disclosure",
  ruleVersion: RULE_VERSION,
  category: "gharar",
  material: false,
  outcome: "pass",
  rationale:
    "Supply is capped and immutable. Mint authority renounced at slot 312,004,118.",
  evidence: [
    {
      type: "onchain",
      account: "Pr0biTy22222222222222222222222222222222UTL2",
      slot: 312_004_118,
      field: "mint_authority",
      value: "null",
    },
  ],
};

const ghararFlag: RuleOutcome = {
  ruleId: "gharar.tokenomics-disclosure",
  ruleVersion: RULE_VERSION,
  category: "gharar",
  material: false,
  outcome: "flag",
  rationale:
    "Reserve composition is reported but counterparty list is partially redacted. Excessive uncertainty risk.",
  evidence: [
    {
      type: "document",
      sourceUrl: "https://example.org/stable/reserves-q1.pdf",
      contentHash: "sha256:c0de…dada",
      excerpt:
        "Reserves are held with regulated counterparties (names withheld) and US Treasury instruments.",
    },
  ],
};

const govPass: RuleOutcome = {
  ruleId: "governance.proposal-transparency",
  ruleVersion: RULE_VERSION,
  category: "governance",
  material: false,
  outcome: "pass",
  rationale:
    "Governance proposals are on-chain with mandatory timelock. Veto authority is multisig 4-of-7.",
  evidence: [
    {
      type: "onchain",
      account: "GovProgramId0000000000000000000000000000000",
      slot: 318_001_002,
      field: "timelock_seconds",
      value: "172800",
    },
  ],
};

const govFlag: RuleOutcome = {
  ruleId: "governance.proposal-transparency",
  ruleVersion: RULE_VERSION,
  category: "governance",
  material: false,
  outcome: "flag",
  rationale:
    "Freeze authority is retained by a single hot key. Material custodial risk.",
  evidence: [
    {
      type: "onchain",
      account: "Pr0biTy11111111111111111111111111111111SOL1",
      slot: 317_998_711,
      field: "freeze_authority",
      value: "Fr0zenSingleK3y0000000000000000000000000000",
    },
  ],
};

const transparencyPass: RuleOutcome = {
  ruleId: "transparency.metadata-immutability",
  ruleVersion: RULE_VERSION,
  category: "transparency",
  material: false,
  outcome: "pass",
  rationale:
    "Metaplex metadata is_mutable=false. URI pinned to IPFS with verified content hash.",
  evidence: [
    {
      type: "onchain",
      account: "MetadataPDA0000000000000000000000000000000",
      slot: 317_001_500,
      field: "is_mutable",
      value: "false",
    },
  ],
};

export const VERDICTS: VerdictRecord[] = [
  {
    mint: "Pr0biTy22222222222222222222222222222222UTL2",
    verdict: "halal",
    ruleVersion: RULE_VERSION,
    computedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * DAY * 1000).toISOString(),
    evidenceHash: "sha256:b1f4c218e9a7d3a8f6b07c95a90c1ee0d1248f95",
    attestationPubkey: "Att3statN1U7L0000000000000000000000000000",
    token: {
      mint: "Pr0biTy22222222222222222222222222222222UTL2",
      symbol: "UTL",
      name: "Demo Utility",
      decimals: 9,
      supply: "1,000,000,000",
      mintAuthority: null,
      freezeAuthority: null,
      topHolderConcentration: 0.182,
    },
    outcomes: [
      ribaPass(
        "No interactions with conventional lending or money-market programs. Treasury yield sourced from protocol fees only.",
      ),
      sectorPass,
      {
        ruleId: "maysir.zero-sum-structures",
        ruleVersion: RULE_VERSION,
        category: "maysir",
        material: true,
        outcome: "pass",
        rationale:
          "Token represents a claim on swap-routing services with identifiable utility.",
        evidence: [
          {
            type: "derivation",
            formula: "utility_score = 0.78 (>= threshold 0.40)",
            result: "utility_basis_confirmed",
          },
        ],
      },
      gharaPass,
      govPass,
      transparencyPass,
    ],
    priceSeries: buildPriceSeries(11, 90, 0.42, 0.004, 0.045),
    holderSeries: buildHolderSeries(11, 90, 18_400, 0.012),
    scoreBreakdown: {
      riba: 1,
      maysir: 1,
      gharar: 0.95,
      sector: 1,
      governance: 0.94,
      transparency: 1,
    },
  },
  {
    mint: "Pr0biTy11111111111111111111111111111111SOL1",
    verdict: "mushtabah",
    ruleVersion: RULE_VERSION,
    computedAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * DAY * 1000).toISOString(),
    evidenceHash: "sha256:8a1c9d24f7eb50ac1c2b8810cf90a311e6b04221",
    attestationPubkey: null,
    token: {
      mint: "Pr0biTy11111111111111111111111111111111SOL1",
      symbol: "DSTB",
      name: "Demo Stablecoin",
      decimals: 6,
      supply: "412,000,000",
      mintAuthority: "M1nt3rPDA000000000000000000000000000000000",
      freezeAuthority: "Fr0zenSingleK3y0000000000000000000000000000",
      topHolderConcentration: 0.41,
    },
    outcomes: [
      ribaPass(
        "Issuer revenue derives from reserve yield in short-term US Treasuries. T-bill yield is contested under traditional jurisprudence — flagged for review but not classified as direct riba.",
      ),
      sectorPass,
      {
        ruleId: "maysir.zero-sum-structures",
        ruleVersion: RULE_VERSION,
        category: "maysir",
        material: true,
        outcome: "pass",
        rationale: "Asset is a pegged stable claim; not a zero-sum instrument.",
        evidence: [
          {
            type: "derivation",
            formula: "peg_deviation_30d = 0.0021",
            result: "peg_stable",
          },
        ],
      },
      ghararFlag,
      govFlag,
      transparencyPass,
    ],
    priceSeries: buildPriceSeries(7, 90, 1.0, 0.0, 0.004),
    holderSeries: buildHolderSeries(7, 90, 92_300, 0.006),
    scoreBreakdown: {
      riba: 0.6,
      maysir: 1,
      gharar: 0.55,
      sector: 1,
      governance: 0.45,
      transparency: 0.9,
    },
  },
  {
    mint: "Pr0biTy33333333333333333333333333333333LND3",
    verdict: "haram",
    ruleVersion: RULE_VERSION,
    computedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * DAY * 1000).toISOString(),
    evidenceHash: "sha256:f12a3c8b9d2e44017b50abc8910f5731cca50a14",
    attestationPubkey: "Att3statN1L3ND0000000000000000000000000000",
    token: {
      mint: "Pr0biTy33333333333333333333333333333333LND3",
      symbol: "LND",
      name: "Demo Lending",
      decimals: 6,
      supply: "250,000,000",
      mintAuthority: "M1nt3rPDA000000000000000000000000000000000",
      freezeAuthority: null,
      topHolderConcentration: 0.33,
    },
    outcomes: [
      ribaFail(
        "Token's distributed yield is the spread between borrow and lend APR on a conventional money-market pool. This is a direct riba violation.",
      ),
      sectorPass,
      {
        ruleId: "maysir.zero-sum-structures",
        ruleVersion: RULE_VERSION,
        category: "maysir",
        material: true,
        outcome: "pass",
        rationale: "Lending is bilateral, not a zero-sum derivative.",
        evidence: [
          { type: "derivation", formula: "zero_sum_score = 0.05", result: "not_zero_sum" },
        ],
      },
      gharaPass,
      govPass,
      transparencyPass,
    ],
    priceSeries: buildPriceSeries(23, 90, 2.7, -0.003, 0.06),
    holderSeries: buildHolderSeries(23, 90, 5_900, -0.002),
    scoreBreakdown: {
      riba: 0,
      maysir: 1,
      gharar: 0.9,
      sector: 1,
      governance: 0.85,
      transparency: 1,
    },
  },
  {
    mint: "Pr0biTy44444444444444444444444444444444GMG4",
    verdict: "mushtabah",
    ruleVersion: RULE_VERSION,
    computedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * DAY * 1000).toISOString(),
    evidenceHash: "sha256:0e7f1d2a6c449820cabb6201f7e30491abd7901d",
    attestationPubkey: null,
    token: {
      mint: "Pr0biTy44444444444444444444444444444444GMG4",
      symbol: "GMG",
      name: "Demo Gaming",
      decimals: 6,
      supply: "1,500,000,000",
      mintAuthority: null,
      freezeAuthority: null,
      topHolderConcentration: 0.27,
    },
    outcomes: [
      ribaPass("No lending-pool interaction detected."),
      sectorFlag,
      {
        ruleId: "maysir.zero-sum-structures",
        ruleVersion: RULE_VERSION,
        category: "maysir",
        material: true,
        outcome: "flag",
        rationale:
          "In-game tournament wagering present below material threshold. Pending human review.",
        evidence: [
          {
            type: "document",
            sourceUrl: "https://example.org/gaming/rules.md",
            contentHash: "sha256:9911…ffaa",
            excerpt: "Tournament entry fees are wagered and redistributed to winners.",
          },
        ],
      },
      gharaPass,
      govPass,
      transparencyPass,
    ],
    priceSeries: buildPriceSeries(41, 90, 0.018, 0.006, 0.09),
    holderSeries: buildHolderSeries(41, 90, 41_200, 0.018),
    scoreBreakdown: {
      riba: 1,
      maysir: 0.55,
      gharar: 0.9,
      sector: 0.7,
      governance: 0.85,
      transparency: 1,
    },
  },
  {
    mint: "Pr0biTy55555555555555555555555555555555NFT5",
    verdict: "halal",
    ruleVersion: RULE_VERSION,
    computedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * DAY * 1000).toISOString(),
    evidenceHash: "sha256:5d44b1e29871c47fab90e1f80c2c2c4119abad55",
    attestationPubkey: "Att3statN1NFT00000000000000000000000000000",
    token: {
      mint: "Pr0biTy55555555555555555555555555555555NFT5",
      symbol: "MKT",
      name: "Demo Marketplace",
      decimals: 9,
      supply: "500,000,000",
      mintAuthority: null,
      freezeAuthority: null,
      topHolderConcentration: 0.155,
    },
    outcomes: [
      ribaPass("Treasury yield 100% from marketplace listing fees."),
      sectorPass,
      {
        ruleId: "maysir.zero-sum-structures",
        ruleVersion: RULE_VERSION,
        category: "maysir",
        material: true,
        outcome: "pass",
        rationale: "Marketplace is a primary-sale venue; not a zero-sum book.",
        evidence: [
          {
            type: "derivation",
            formula: "primary_sale_ratio = 0.91",
            result: "predominantly_primary_market",
          },
        ],
      },
      gharaPass,
      govPass,
      transparencyPass,
    ],
    priceSeries: buildPriceSeries(59, 90, 0.84, 0.003, 0.05),
    holderSeries: buildHolderSeries(59, 90, 27_100, 0.014),
    scoreBreakdown: {
      riba: 1,
      maysir: 1,
      gharar: 0.95,
      sector: 1,
      governance: 0.9,
      transparency: 1,
    },
  },
];

export function findVerdict(query: string): VerdictRecord | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return VERDICTS.find(
    (v) =>
      v.mint.toLowerCase() === q ||
      v.token.symbol.toLowerCase() === q ||
      v.token.name.toLowerCase() === q,
  );
}
