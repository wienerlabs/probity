export type {
  Verdict,
  RuleCategory,
  RuleOutcomeKind,
  Citation,
  CitationOnchain,
  CitationDocument,
  CitationDerivation,
  RuleOutcome,
  ScreeningContext,
  ScoreBreakdown,
  VerdictRecord,
  SolanaTokenState,
  EnrichmentBundle,
  RevenueModel,
  SectorExposure,
  SectorTag,
  GovernanceShape,
  ProgramInteraction,
  TokenMetadata,
} from "@probity/types";

// UI-only types that aren't part of the engine surface.
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
