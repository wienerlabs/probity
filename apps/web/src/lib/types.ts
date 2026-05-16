export type Verdict = "halal" | "mushtabah" | "haram";

export type RuleCategory =
  | "riba"
  | "maysir"
  | "gharar"
  | "haram-sector"
  | "governance"
  | "transparency";

export type RuleOutcomeKind = "pass" | "fail" | "flag";

export interface CitationOnchain {
  type: "onchain";
  account: string;
  slot: number;
  field: string;
  value: string;
}

export interface CitationDocument {
  type: "document";
  sourceUrl: string;
  contentHash: string;
  excerpt: string;
}

export interface CitationDerivation {
  type: "derivation";
  formula: string;
  result: string;
}

export type Citation = CitationOnchain | CitationDocument | CitationDerivation;

export interface RuleOutcome {
  ruleId: string;
  ruleVersion: string;
  category: RuleCategory;
  material: boolean;
  outcome: RuleOutcomeKind;
  rationale: string;
  evidence: Citation[];
}

export interface TokenSummary {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  topHolderConcentration: number;
}

export interface PriceSeriesPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface HolderSeriesPoint {
  time: number;
  value: number;
}

export interface VerdictRecord {
  mint: string;
  verdict: Verdict;
  ruleVersion: string;
  computedAt: string;
  expiresAt: string;
  evidenceHash: string;
  attestationPubkey: string | null;
  token: TokenSummary;
  outcomes: RuleOutcome[];
  priceSeries: PriceSeriesPoint[];
  holderSeries: HolderSeriesPoint[];
  scoreBreakdown: {
    riba: number;
    maysir: number;
    gharar: number;
    sector: number;
    governance: number;
    transparency: number;
  };
}
