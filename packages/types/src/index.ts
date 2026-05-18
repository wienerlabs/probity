// Canonical Probity screening domain model.
// Versioned. Any breaking change ships under a new ruleVersion AND
// requires a coordinated bump in packages/engine and packages/rules.

export type Verdict = "halal" | "mushtabah" | "haram";

export type RuleCategory =
  | "riba"
  | "maysir"
  | "gharar"
  | "haram-sector"
  | "governance"
  | "transparency";

export type RuleOutcomeKind = "pass" | "fail" | "flag";

// ---------- Citations ----------

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
  inputs?: Citation[];
}

export type Citation = CitationOnchain | CitationDocument | CitationDerivation;

// ---------- Token state (Solana-native input) ----------

export interface HolderEntry {
  address: string;
  share: number; // 0..1
}

export interface ProgramInteraction {
  program: string;
  kind:
    | "lending-interest-bearing"
    | "lending-collateral-only"
    | "amm-swap"
    | "staking"
    | "governance"
    | "marketplace"
    | "other";
  primaryRevenueShare: number; // 0..1
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
}

export interface Token2022Extension {
  type: string;
  details?: Record<string, unknown>;
}

export interface SolanaTokenState {
  mint: string;
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  metadata: TokenMetadata;
  metadataAccount: string;
  topHolderConcentration: number;
  topHolders: HolderEntry[];
  programInteractions: ProgramInteraction[];
  snapshotSlot: number;
  tokenProgram?: "spl-token" | "spl-token-2022";
  extensions?: Token2022Extension[];
}

// ---------- Enrichment (off-chain, supplied by ingestion layer) ----------

export type SectorTag =
  | "alcohol"
  | "gambling"
  | "adult"
  | "tobacco"
  | "weapons"
  | "conventional-finance"
  | "pork"
  | "lending-interest"
  | "primary-utility"
  | "marketplace"
  | "gaming"
  | "stablecoin"
  | "infra";

export interface SectorExposure {
  tag: SectorTag;
  revenueShare: number; // 0..1
  source: CitationDocument | CitationDerivation;
}

export interface RevenueModel {
  primary: string;
  exposures: SectorExposure[];
  zeroSumRevenueShare: number; // 0..1
  utilityScore: number; // 0..1 — higher = clearer utility basis
  primarySaleRatio?: number; // 0..1 — marketplace primary-vs-secondary
}

export interface GovernanceShape {
  timelockSeconds: number | null;
  multisigThreshold: { m: number; n: number } | null;
  freezeAuthoritySingleKey: boolean;
}

export interface EnrichmentBundle {
  whitepaperUrl?: string;
  audits: CitationDocument[];
  revenueModel: RevenueModel;
  governance: GovernanceShape;
  reserveDisclosure?: CitationDocument;
}

// ---------- Screening context ----------

export interface ScreeningContext {
  mint: string;
  state: SolanaTokenState;
  enrichment: EnrichmentBundle;
  ruleVersion: string; // semver, must match a rule set in packages/rules
  now: Date;
}

// ---------- Rule outcomes & definitions ----------

export interface RuleOutcome {
  ruleId: string;
  ruleVersion: string;
  category: RuleCategory;
  material: boolean;
  outcome: RuleOutcomeKind;
  rationale: string; // human-readable, <500 chars
  evidence: Citation[];
}

export interface RuleDefinition {
  id: string;
  version: string;
  material: boolean;
  category: RuleCategory;
  description: string;
  evaluate: (ctx: ScreeningContext) => Promise<RuleOutcome> | RuleOutcome;
}

// ---------- Verdict ----------

export interface ScoreBreakdown {
  riba: number;
  maysir: number;
  gharar: number;
  sector: number;
  governance: number;
  transparency: number;
}

export interface VerdictRecord {
  mint: string;
  verdict: Verdict;
  ruleVersion: string;
  computedAt: string; // ISO
  expiresAt: string; // ISO
  evidenceHash: string; // sha256:<hex>
  attestationPubkey: string | null;
  outcomes: RuleOutcome[];
  scoreBreakdown: ScoreBreakdown;
}
